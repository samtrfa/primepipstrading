import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BSCSCAN_API_KEY = Deno.env.get("BSCSCAN_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// The wallet address to check for incoming payments
const WALLET_ADDRESS = "0x66aeC4645A4d204653d2e62FCA26968Ce1B5db1a";

// Payment expiry time in minutes (accounts pending for longer will be marked failed)
const PAYMENT_EXPIRY_MINUTES = 10;

// Token contract addresses on BSC
const TOKEN_CONTRACTS: Record<string, { address: string; decimals: number }> = {
  USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  BUSD: { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
};

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  timeStamp: string;
}

interface Account {
  id: string;
  user_id: string;
  price: number;
  status: string;
  created_at: string;
  payment_tx_hash: string | null;
}

// Fetch BEP-20 token transactions to our wallet
async function fetchTokenTransactions(tokenAddress: string): Promise<Transaction[]> {
  const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${WALLET_ADDRESS}&page=1&offset=100&sort=desc&apikey=${BSCSCAN_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "1" && Array.isArray(data.result)) {
      return data.result;
    }
    console.log(`No transactions found for token ${tokenAddress}:`, data.message);
    return [];
  } catch (error) {
    console.error(`Error fetching transactions for token ${tokenAddress}:`, error);
    return [];
  }
}

// Fetch native BNB transactions to our wallet
async function fetchBnbTransactions(): Promise<Transaction[]> {
  const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${WALLET_ADDRESS}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${BSCSCAN_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "1" && Array.isArray(data.result)) {
      return data.result.filter((tx: Transaction) => 
        tx.to.toLowerCase() === WALLET_ADDRESS.toLowerCase() && 
        parseFloat(tx.value) > 0
      );
    }
    console.log("No BNB transactions found:", data.message);
    return [];
  } catch (error) {
    console.error("Error fetching BNB transactions:", error);
    return [];
  }
}

// Convert wei to token amount based on decimals
function weiToAmount(wei: string, decimals: number): number {
  return parseFloat(wei) / Math.pow(10, decimals);
}

// Check if a transaction matches a pending account payment
function findMatchingTransaction(
  transactions: Transaction[],
  account: Account,
  decimals: number
): Transaction | null {
  const accountCreatedTime = new Date(account.created_at).getTime() / 1000;
  const priceUsd = account.price;
  
  // Allow 5% tolerance for price fluctuations
  const minAmount = priceUsd * 0.95;
  const maxAmount = priceUsd * 1.05;
  
  for (const tx of transactions) {
    const txTime = parseInt(tx.timeStamp);
    const txAmount = weiToAmount(tx.value, decimals);
    
    // Transaction must be after account creation
    if (txTime >= accountCreatedTime - 60) { // Allow 1 minute buffer
      // Check if amount matches within tolerance
      if (txAmount >= minAmount && txAmount <= maxAmount) {
        console.log(`Found matching transaction: ${tx.hash} for $${txAmount} (expected: $${priceUsd})`);
        return tx;
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting BSC payment verification...");
    
    if (!BSCSCAN_API_KEY) {
      throw new Error("BSCSCAN_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch all pending payment accounts
    const { data: pendingAccounts, error: fetchError } = await supabase
      .from("accounts")
      .select("*")
      .eq("status", "pending_payment");

    if (fetchError) {
      throw new Error(`Failed to fetch pending accounts: ${fetchError.message}`);
    }

    if (!pendingAccounts || pendingAccounts.length === 0) {
      console.log("No pending payments to verify");
      return new Response(
        JSON.stringify({ message: "No pending payments", verified: 0, expired: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingAccounts.length} pending accounts to verify`);

    // Fetch all token transactions
    const [usdtTxs, usdcTxs, busdTxs, bnbTxs] = await Promise.all([
      fetchTokenTransactions(TOKEN_CONTRACTS.USDT.address),
      fetchTokenTransactions(TOKEN_CONTRACTS.USDC.address),
      fetchTokenTransactions(TOKEN_CONTRACTS.BUSD.address),
      fetchBnbTransactions(),
    ]);

    console.log(`Fetched transactions - USDT: ${usdtTxs.length}, USDC: ${usdcTxs.length}, BUSD: ${busdTxs.length}, BNB: ${bnbTxs.length}`);

    let verifiedCount = 0;
    let expiredCount = 0;

    for (const account of pendingAccounts as Account[]) {
      const accountAgeMinutes = (Date.now() - new Date(account.created_at).getTime()) / (1000 * 60);
      
      // Check if payment has expired
      if (accountAgeMinutes > PAYMENT_EXPIRY_MINUTES) {
        console.log(`Account ${account.id} payment expired after ${accountAgeMinutes.toFixed(0)} minutes`);
        
        const { error: expireError } = await supabase
          .from("accounts")
          .update({ status: "failed" })
          .eq("id", account.id);
        
        if (expireError) {
          console.error(`Failed to expire account ${account.id}:`, expireError);
        } else {
          expiredCount++;
        }
        continue;
      }

      // Try to find matching transaction in each token type
      let matchingTx: Transaction | null = null;
      
      matchingTx = findMatchingTransaction(usdtTxs, account, TOKEN_CONTRACTS.USDT.decimals);
      if (!matchingTx) {
        matchingTx = findMatchingTransaction(usdcTxs, account, TOKEN_CONTRACTS.USDC.decimals);
      }
      if (!matchingTx) {
        matchingTx = findMatchingTransaction(busdTxs, account, TOKEN_CONTRACTS.BUSD.decimals);
      }
      if (!matchingTx) {
        // For BNB, we'd need to convert BNB to USD - skipping for now as stablecoins are preferred
        // matchingTx = findMatchingTransaction(bnbTxs, account, 18);
      }

      if (matchingTx) {
        console.log(`Activating account ${account.id} with tx ${matchingTx.hash}`);
        
        const { error: activateError } = await supabase
          .from("accounts")
          .update({ 
            status: "active",
            payment_tx_hash: matchingTx.hash 
          })
          .eq("id", account.id);
        
        if (activateError) {
          console.error(`Failed to activate account ${account.id}:`, activateError);
        } else {
          verifiedCount++;
        }
      } else {
        console.log(`No matching transaction found for account ${account.id} ($${account.price})`);
      }
    }

    const result = {
      message: "Payment verification completed",
      pending: pendingAccounts.length,
      verified: verifiedCount,
      expired: expiredCount,
    };

    console.log("Verification complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in verify-bsc-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

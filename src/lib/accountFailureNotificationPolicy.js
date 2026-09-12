export function shouldCreateAccountFailureNotification(oldStatus, newStatus) {
  return newStatus === "failed" && oldStatus !== newStatus && oldStatus !== "pending_payment";
}

export function getAccountFailureNotification(oldStatus, newStatus) {
  if (oldStatus === "pending_payment" && newStatus === "failed") {
    return {
      type: "payment_expired",
      title: "Payment not completed",
      message: "This account purchase expired or was declined before payment was confirmed. You can retry purchase from the checkout page.",
    };
  }

  return {
    type: "account_failure",
    title: "Account failed",
    message: "Your trading account has breached its rules. Review your account details for more information.",
  };
}

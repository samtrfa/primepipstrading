export function getAccountVisitChanges(previousAccountIds, currentAccountIds) {
  const previous = new Set(previousAccountIds);
  const current = new Set(currentAccountIds);

  return {
    added: [...current].filter((id) => !previous.has(id)).length,
    removed: [...previous].filter((id) => !current.has(id)).length,
  };
}

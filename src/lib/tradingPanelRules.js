export function shouldModifyPositionForAsset(currentPosition, candidatePosition, applyPositionToAsset) {
  if (!applyPositionToAsset) {
    return currentPosition.id === candidatePosition.id;
  }

  return (
    candidatePosition.status === 'open' &&
    candidatePosition.asset_id === currentPosition.asset_id &&
    candidatePosition.position_type === currentPosition.position_type
  );
}

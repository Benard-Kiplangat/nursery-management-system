import { isBatchReady } from "../db";

export function getEligibleBatches(availableBatches = [], isPresale = false) {
  return isPresale
    ? availableBatches
    : availableBatches.filter(batch => isBatchReady(batch));
}

export function selectBatch(availableBatches, selectedBatchId) {
  const chosenBatchId = selectedBatchId || availableBatches[0]?._id;
  return availableBatches.find(batch => batch._id === chosenBatchId);
}

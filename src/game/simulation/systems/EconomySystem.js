function validateAmount(amount) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('Scrap amount must be a non-negative finite number.');
  }
}

export class EconomySystem {
  constructor(gameState) {
    this.gameState = gameState;
  }

  awardScrap(amount) {
    validateAmount(amount);
    this.gameState.scrap += amount;
    return this.gameState.scrap;
  }

  spendScrap(amount) {
    validateAmount(amount);

    if (this.gameState.scrap < amount) {
      return false;
    }

    this.gameState.scrap -= amount;
    return true;
  }
}

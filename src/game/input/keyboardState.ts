export class KeyboardState {
  private down = new Set<string>();
  private pressed = new Set<string>();

  keyDown(code: string, repeat: boolean) {
    if (!repeat && !this.down.has(code)) {
      this.pressed.add(code);
    }
    this.down.add(code);
  }

  keyUp(code: string) {
    this.down.delete(code);
  }

  isDown(code: string) {
    return this.down.has(code);
  }

  consumePress(code: string) {
    const wasPressed = this.pressed.has(code);
    this.pressed.delete(code);
    return wasPressed;
  }

  reset() {
    this.down.clear();
    this.pressed.clear();
  }
}

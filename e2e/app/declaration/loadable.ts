/** Something the browser can navigate to and confirm it has arrived at. */
export interface LoadableComponent {
  expectLoaded(message?: string): Promise<void>;
}

import { ApiClient, type User } from "../api";
import { PageHolder } from "./pageHolder";
import { Header } from "./component/header.component";
import { Cart } from "./page/cart.page";
import { Catalogue } from "./page/catalogue.page";
import { ForgotPassword } from "./page/forgot-password.page";
import { Home } from "./page/home.page";
import { Profile } from "./page/profile.page";
import { Register } from "./page/register.page";
import { ResetPassword } from "./page/reset-password.page";
import { SignIn } from "./page/sign-in.page";

/** Every page of the web app, reached through one object: `app.catalogue.open()`, `app.cart.expectEmpty()`. */
export class Application extends PageHolder {
  readonly header = new Header(this.page);
  readonly home = new Home(this.page);
  readonly register = new Register(this.page);
  readonly signIn = new SignIn(this.page);
  readonly forgotPassword = new ForgotPassword(this.page);
  readonly resetPassword = new ResetPassword(this.page);
  readonly profile = new Profile(this.page);
  readonly catalogue = new Catalogue(this.page);
  readonly cart = new Cart(this.page);

  /** For a path no page object owns, such as one that should not exist. */
  async goto(path: string) {
    return this.page.goto(path);
  }

  /** Signs this browser in through the API — the session cookies land in its context. */
  async signInThroughApi(user: Pick<User, "email" | "password">) {
    await new ApiClient(this.page.request).signIn(user);
  }

  async goBack() {
    await this.page.goBack();
  }
}

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../components/Field";

describe("Field", () => {
  it("XC-041: associates the label with the input", () => {
    render(<Field id="email" label="Email address" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("XC-042: reports every error for the field", () => {
    render(<Field id="password" label="Password" value="" onChange={() => {}} errors={["Too short", "Needs a digit"]} />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.getByText("Needs a digit")).toBeInTheDocument();
  });

  it("XC-043: marks the input invalid and points at its error text", () => {
    render(<Field id="email" label="Email address" value="" onChange={() => {}} errors={["Enter a valid email address"]} />);
    const input = screen.getByLabelText("Email address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
  });

  it("XC-044: reports each keystroke", async () => {
    const onChange = vi.fn();
    render(<Field id="name" label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

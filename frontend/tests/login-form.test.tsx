import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "@/features/auth/components/login-form";
import { signIn } from "@/features/auth/client";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/features/auth/client", () => ({ signIn: vi.fn() }));

beforeEach(() => {
  vi.mocked(signIn).mockReset();
  replace.mockReset();
  refresh.mockReset();
});

describe("login interface", () => {
  it("submits credentials to the connected login and opens inventory", async () => {
    vi.mocked(signIn).mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174000",
      email: "owner@example.com",
      role: "customer",
      name: "",
      phone: "",
      permissions: [],
      preferences: {},
      email_verified: false,
    });
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Email address"),
      "owner@example.com",
    );
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "test-password",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: "owner@example.com",
        password: "test-password",
      }),
    );
    expect(replace).toHaveBeenCalledWith("/account");
    expect(refresh).toHaveBeenCalled();
  });
  it("shows backend errors in an accessible alert", async () => {
    vi.mocked(signIn).mockRejectedValue(new Error("Invalid email or password"));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "wrong" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form")!,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
    expect(replace).not.toHaveBeenCalled();
  });
  it("disables submission while the request is pending", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "secret" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form")!,
    );
    expect(
      await screen.findByRole("button", { name: "Signing in…" }),
    ).toBeDisabled();
  });
  it("supports showing and hiding the password", async () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
  });
});

it("never puts credentials into a URL if a browser submits before hydration", () => {
  render(<LoginForm />);
  expect(
    screen.getByRole("button", { name: "Sign in" }).closest("form"),
  ).toHaveAttribute("method", "post");
});

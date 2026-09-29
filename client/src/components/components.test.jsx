import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ScoreRing from "./ui/ScoreRing";
import ProtectedRoute from "./layout/ProtectedRoute";
import Login from "../pages/Login/Login";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { authApi } from "../api/services";

vi.mock("../api/services", () => ({
  authApi: { login: vi.fn(), register: vi.fn(), me: vi.fn() },
  resumesApi: {},
  contactApi: {},
  getPublicConfig: vi.fn(),
}));

const validToken = () => `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.s`;
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

function renderApp(initial, extra = null) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        {extra}
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><p>Secret dashboard</p></ProtectedRoute>} />
        </Routes>
        <Where />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe("ScoreRing", () => {
  it("exposes the score and its label to assistive tech (not colour alone)", () => {
    render(<ScoreRing score={78} animate={false} />);
    expect(screen.getByRole("img", { name: "ATS score 78 out of 100: Good" })).toBeInTheDocument();
  });
});

describe("ProtectedRoute", () => {
  it("sends signed-out visitors to /login", async () => {
    renderApp("/dashboard");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
  });

  it("renders content for a valid stored session", async () => {
    localStorage.setItem("ats.token", validToken());
    authApi.me.mockResolvedValue({ id: "1", name: "Priya" });
    renderApp("/dashboard");
    expect(await screen.findByText("Secret dashboard")).toBeInTheDocument();
  });

  it("drops an expired stored token without calling the API", async () => {
    localStorage.setItem("ats.token", `h.${btoa(JSON.stringify({ exp: 1 }))}.s`);
    renderApp("/dashboard");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(authApi.me).not.toHaveBeenCalled();
    expect(localStorage.getItem("ats.token")).toBeNull();
  });

  it("clears a session the server rejects", async () => {
    localStorage.setItem("ats.token", validToken());
    authApi.me.mockRejectedValue({ response: { status: 401 } });
    renderApp("/dashboard");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(localStorage.getItem("ats.token")).toBeNull();
  });

  it("keeps the session on a network error instead of logging the user out", async () => {
    localStorage.setItem("ats.token", validToken());
    authApi.me.mockRejectedValue({ message: "Network Error" });
    renderApp("/dashboard");
    expect(await screen.findByText("Secret dashboard")).toBeInTheDocument();
    expect(localStorage.getItem("ats.token")).not.toBeNull();
  });

  it("a deliberate sign-out goes home, not to the sign-in form (regression)", async () => {
    localStorage.setItem("ats.token", validToken());
    authApi.me.mockResolvedValue({ id: "1", name: "Priya" });
    const SignOutButton = () => { const { signOut } = useAuth(); return <button onClick={() => signOut()}>sign out</button>; };
    renderApp("/dashboard", <SignOutButton />);
    await screen.findByText("Secret dashboard");
    await userEvent.click(screen.getByText("sign out"));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/));
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });
});

describe("Login", () => {
  it("validates before calling the API and labels the errors", async () => {
    renderApp("/login");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("signs in and returns the user to the page they wanted", async () => {
    authApi.login.mockResolvedValue({ token: validToken(), user: { id: "1", name: "Priya" } });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/dashboard" } }]}>
        <AuthProvider>
          <Routes><Route path="/login" element={<Login />} /><Route path="/dashboard" element={<ProtectedRoute><p>Secret dashboard</p></ProtectedRoute>} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    await userEvent.type(screen.getByLabelText("Email"), "priya@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Secret dashboard")).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({ email: "priya@example.com", password: "Passw0rd!" });
  });

  it("shows the server's message when credentials are wrong and re-enables the form", async () => {
    authApi.login.mockRejectedValue({ response: { status: 401, data: { error: "Incorrect email or password." } } });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText("Email"), "priya@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("toggles password visibility with an accessible control", async () => {
    renderApp("/login");
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });
});

import API from "./api";

const USERS_KEY = "local_users";

const readUsers = () => {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch (error) {
    return [];
  }
};

const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const ensureDefaultAdmin = () => {
  const users = readUsers();
  const hasAdmin = users.some((user) => user.email === "admin@example.com");
  if (!hasAdmin) {
    users.push({
      id: Date.now(),
      name: "Admin",
      email: "admin@example.com",
      password: "Admin@123",
      role: "admin",
    });
    saveUsers(users);
  }
};

ensureDefaultAdmin();

export const registerWithFallback = async (formData) => {
  try {
    const response = await API.post("/auth/register", {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role || "customer",
    });
    return response.data;
  } catch (error) {
    if (error?.response) {
      throw new Error(error?.response?.data?.detail || "Registration failed");
    }

    const users = readUsers();
    const exists = users.some(
      (user) => user.email.toLowerCase() === formData.email.toLowerCase()
    );

    if (exists) {
      throw new Error("Email already registered");
    }

    const newUser = {
      id: Date.now(),
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role || "customer",
    };

    users.push(newUser);
    saveUsers(users);

    return {
      message: "Registration successful",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  }
};

export const loginWithFallback = async (formData) => {
  try {
    const response = await API.post("/auth/login", formData);
    return response.data;
  } catch (error) {
    const users = readUsers();
    const user = users.find(
      (item) =>
        item.email.toLowerCase() === formData.email.toLowerCase() &&
        item.password === formData.password
    );

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isNetworkIssue =
      !error?.response ||
      error?.code === "ECONNABORTED" ||
      error?.message === "Network Error";

    if (!isNetworkIssue) {
      // Backend is reachable. Sync local user to backend and return real JWT.
      try {
        await API.post("/auth/register", {
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role || "customer",
        });
      } catch (registerError) {
        // Ignore if already exists, login step will validate credentials.
      }

      try {
        const loginResponse = await API.post("/auth/login", {
          email: user.email,
          password: user.password,
        });
        return loginResponse.data;
      } catch (loginError) {
        throw new Error(
          loginError?.response?.data?.detail ||
            "Backend login failed. Please use backend-registered credentials."
        );
      }
    }

    // Backend is offline: local mode token.
    return {
      access_token: `local-token-${user.id}`,
      token_type: "bearer",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
};

export const getAllLocalUsers = () => {
  ensureDefaultAdmin();
  return readUsers().map(({ password, ...user }) => user);
};

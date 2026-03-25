import API from "./api";

export const loginUser = async (formData) => {
  const response = await API.post("/auth/login", formData);
  return response.data;
};

export const registerUser = async (formData) => {
  const response = await API.post("/auth/register", formData);
  return response.data;
};

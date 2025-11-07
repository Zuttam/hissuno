import axios from "axios";

export const apiClient = axios.create({
  baseURL: "http://localhost:4000/api",
  timeout: 10_000
});


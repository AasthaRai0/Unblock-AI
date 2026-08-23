import { api } from "./client";

export const AuthAPI = {
  login: (email: string, password: string) => api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
};

export const DashboardAPI = {
  summary: () => api.get("/dashboard/summary"),
  recentEvents: (limit = 15) => api.get(`/dashboard/recent-events?limit=${limit}`),
  revenueTrend: () => api.get("/dashboard/revenue-trend"),
  faultDistribution: () => api.get("/dashboard/fault-distribution"),
};

export const TransactionsAPI = {
  list: (params: Record<string, any> = {}) => api.get("/transactions", { params }),
  get: (id: string) => api.get(`/transactions/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/transactions/${id}/status`, { status }),
};

export const DeadlocksAPI = {
  list: (params: Record<string, any> = {}) => api.get("/deadlocks", { params }),
  get: (id: string) => api.get(`/deadlocks/${id}`),
  analyze: (id: string) => api.post(`/deadlocks/${id}/analyze`),
  resolve: (id: string) => api.post(`/deadlocks/${id}/resolve`),
  markRecovered: (id: string) => api.post(`/deadlocks/${id}/mark-recovered`),
  escalate: (id: string, reason?: string) => api.post(`/deadlocks/${id}/escalate`, { reason }),
};

export const RecoveryAPI = {
  listMissions: () => api.get("/recovery/missions"),
  createMission: (payload: Record<string, any>) => api.post("/recovery/missions", payload),
  startMission: (id: string) => api.post(`/recovery/missions/${id}/start`),
  stopMission: (id: string) => api.post(`/recovery/missions/${id}/stop`),
  missionStats: (id: string) => api.get(`/recovery/missions/${id}/stats`),
};

export const VendorsAPI = {
  list: (params: Record<string, any> = {}) => api.get("/vendors", { params }),
  get: (id: string) => api.get(`/vendors/${id}`),
  health: (id: string) => api.get(`/vendors/${id}/health`),
};

export const AuditAPI = {
  list: (limit = 50, offset = 0) => api.get(`/audit-logs?limit=${limit}&offset=${offset}`),
  forTransaction: (transactionId: string) => api.get(`/audit-logs/${transactionId}`),
};

export const HumanReviewAPI = {
  list: () => api.get("/human-review"),
  approve: (id: string) => api.post(`/human-review/${id}/approve`),
  reject: (id: string, reason?: string) => api.post(`/human-review/${id}/reject`, { reason }),
};

export const SimulatorAPI = {
  generateTransactions: (count: number) => api.post("/simulator/generate-transactions", { count }),
  createDeadlock: (scenario: string) => api.post("/simulator/create-deadlock", { scenario }),
  runBatch: (count = 0) => api.post("/simulator/run-batch", { count }),
};

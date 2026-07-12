const API_BASE = 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return localStorage.getItem('assetflow_token');
  }

  setToken(token) {
    localStorage.setItem('assetflow_token', token);
  }

  clearToken() {
    localStorage.removeItem('assetflow_token');
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    // Handle CSV downloads
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      const blob = await response.blob();
      return blob;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  get(endpoint) {
    return this.request(endpoint);
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth
  login(email, password) {
    return this.post('/auth/login', { email, password });
  }

  signup(data) {
    return this.post('/auth/signup', data);
  }

  getMe() {
    return this.get('/auth/me');
  }

  forgotPassword(email) {
    return this.post('/auth/forgot-password', { email });
  }

  // Dashboard
  getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  // Departments
  getDepartments() {
    return this.get('/departments');
  }
  createDepartment(data) {
    return this.post('/departments', data);
  }
  updateDepartment(id, data) {
    return this.put(`/departments/${id}`, data);
  }
  deleteDepartment(id) {
    return this.delete(`/departments/${id}`);
  }

  // Categories
  getCategories() {
    return this.get('/categories');
  }
  createCategory(data) {
    return this.post('/categories', data);
  }
  updateCategory(id, data) {
    return this.put(`/categories/${id}`, data);
  }
  deleteCategory(id) {
    return this.delete(`/categories/${id}`);
  }

  // Employees
  getEmployees(params = '') {
    return this.get(`/employees${params ? '?' + params : ''}`);
  }
  updateEmployeeRole(id, role) {
    return this.put(`/employees/${id}/role`, { role });
  }
  updateEmployeeStatus(id, status) {
    return this.put(`/employees/${id}/status`, { status });
  }

  // Assets
  getAssets(params = '') {
    return this.get(`/assets${params ? '?' + params : ''}`);
  }
  getAsset(id) {
    return this.get(`/assets/${id}`);
  }
  createAsset(data) {
    return this.post('/assets', data);
  }
  updateAsset(id, data) {
    return this.put(`/assets/${id}`, data);
  }

  // Allocations
  getAllocations(params = '') {
    return this.get(`/allocations${params ? '?' + params : ''}`);
  }
  getOverdueAllocations() {
    return this.get('/allocations/overdue');
  }
  createAllocation(data) {
    return this.post('/allocations', data);
  }
  returnAsset(allocationId, notes) {
    return this.put(`/allocations/${allocationId}/return`, { returnConditionNotes: notes });
  }

  // Transfers
  getTransfers(params = '') {
    return this.get(`/transfers${params ? '?' + params : ''}`);
  }
  createTransfer(data) {
    return this.post('/transfers', data);
  }
  approveTransfer(id) {
    return this.put(`/transfers/${id}/approve`, {});
  }
  rejectTransfer(id) {
    return this.put(`/transfers/${id}/reject`, {});
  }

  // Bookings
  getBookings(params = '') {
    return this.get(`/bookings${params ? '?' + params : ''}`);
  }
  getBookableResources() {
    return this.get('/bookings/resources');
  }
  createBooking(data) {
    return this.post('/bookings', data);
  }
  cancelBooking(id) {
    return this.put(`/bookings/${id}/cancel`, {});
  }
  rescheduleBooking(id, data) {
    return this.put(`/bookings/${id}/reschedule`, data);
  }

  // Maintenance
  getMaintenanceRequests(params = '') {
    return this.get(`/maintenance${params ? '?' + params : ''}`);
  }
  createMaintenanceRequest(data) {
    return this.post('/maintenance', data);
  }
  approveMaintenance(id) {
    return this.put(`/maintenance/${id}/approve`, {});
  }
  rejectMaintenance(id) {
    return this.put(`/maintenance/${id}/reject`, {});
  }
  assignTechnician(id, technicianId) {
    return this.put(`/maintenance/${id}/assign`, { technicianId });
  }
  startMaintenance(id) {
    return this.put(`/maintenance/${id}/start`, {});
  }
  resolveMaintenance(id) {
    return this.put(`/maintenance/${id}/resolve`, {});
  }

  // Audits
  getAuditCycles(params = '') {
    return this.get(`/audits${params ? '?' + params : ''}`);
  }
  getAuditCycle(id) {
    return this.get(`/audits/${id}`);
  }
  createAuditCycle(data) {
    return this.post('/audits', data);
  }
  updateAuditItem(cycleId, itemId, data) {
    return this.put(`/audits/${cycleId}/items/${itemId}`, data);
  }
  closeAuditCycle(id) {
    return this.put(`/audits/${id}/close`, {});
  }
  getAuditDiscrepancies(id) {
    return this.get(`/audits/${id}/discrepancies`);
  }

  // Reports
  getAssetUtilization() {
    return this.get('/reports/asset-utilization');
  }
  getMaintenanceFrequency() {
    return this.get('/reports/maintenance-frequency');
  }
  getDepartmentAllocation() {
    return this.get('/reports/department-allocation');
  }
  getBookingHeatmap() {
    return this.get('/reports/booking-heatmap');
  }
  getAssetsCondition() {
    return this.get('/reports/assets-condition');
  }
  exportReport(type) {
    return this.request(`/reports/export/${type}`);
  }

  // Notifications
  getNotifications(unreadOnly = false) {
    return this.get(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
  }
  markNotificationRead(id) {
    return this.put(`/notifications/${id}/read`, {});
  }
  markAllNotificationsRead() {
    return this.put('/notifications/read-all', {});
  }

  // Activity Logs
  getActivityLogs(params = '') {
    return this.get(`/activity-logs${params ? '?' + params : ''}`);
  }

  // System Settings
  getSystemSettings() {
    return this.get('/settings');
  }
  updateSystemSettings(data) {
    return this.post('/settings', data);
  }
}

export const api = new ApiClient();
export default api;

import { createBrowserRouter } from 'react-router-dom';

import { AdminDashboard } from '../pages/AdminDashboard';
import { AdminLogin } from '../pages/AdminLogin';
import { StatusPage } from '../pages/StatusPage';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/', element: <StatusPage /> },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  { path: '/admin/login', element: <AdminLogin /> },
]);


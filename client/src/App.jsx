import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ReportPage from './pages/ReportPage'; // NEW
import AboutPage from './pages/AboutPage';


function ReportPageWrapper() {
  const { id } = useParams();
  return <ReportPage key={id} />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* NEW: report page, also protected — /report/:id */}
          <Route
            path="/report/:id"
            element={
              <ProtectedRoute>
                <ReportPageWrapper />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
        
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
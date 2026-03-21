import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './pages/MainLayout';
import MapPage from './pages/MapPage';
import ChatLayout from './pages/ChatLayout';
import ProfilePage from './pages/ProfilePage';
import FeedbackPage from './pages/FeedbackPage';
import './index.css';

const AuthGuard = ({ children }) => {
  const location = useLocation();
  const storedToken = localStorage.getItem('token');

  if (!storedToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/chats" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="chats/*" element={<ChatLayout />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./pages/AuthCallback";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "react-hot-toast";
import "./App.css";

const HomePage = lazy(() => import("./pages/HomePage"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));

const PageLoader = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh", color: "#9ca3af", fontSize: "14px" }}>
    Loading...
  </div>
);

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/editor/:roomId"
            element={
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default App;

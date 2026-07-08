import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "react-hot-toast";
import "./App.css";

// Route-level code splitting: the heavy editor bundle (CodeMirror + grammars)
// is no longer shipped on the login/home first paint.
const HomePage = lazy(() => import("./pages/HomePage"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const RouteFallback = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      background: "#0d1117",
      color: "#9ca3af",
    }}
  >
    <h2>Loading…</h2>
  </div>
);

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
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

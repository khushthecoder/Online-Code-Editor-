import { Routes, Route } from 'react-router-dom'; 
import HomePage from './pages/HomePage'; 
import LoginPage from './pages/LoginPage'; 
import SignupPage from './pages/SignupPage'; 
import ProtectedRoute from './components/ProtectedRoute'; 
import EditorPage from './pages/EditorPage'; 

function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<EditorPage />} /> 
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Routes>
  );
}
export default App;
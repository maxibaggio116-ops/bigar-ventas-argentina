import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Droplets } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const { token, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <Droplets className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bigar S.A.</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestion de Ventas</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electronico
            </label>
            <input
              type="email"
              className="input"
              placeholder="usuario@bigar.com.ar"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrasena
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-3 text-base"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-2">Credenciales de prueba</p>
          <p className="text-xs text-gray-500 font-medium">Admin:</p>
          <p className="text-xs text-gray-600">admin@bigar.com.ar / admin123</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Vendedor:</p>
          <p className="text-xs text-gray-600">vendedor@bigar.com.ar / vendedor123</p>
        </div>
      </div>
    </div>
  );
}

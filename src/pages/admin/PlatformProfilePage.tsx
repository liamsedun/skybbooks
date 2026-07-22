import { useAuth } from '../../hooks/useAuth';
import { User, Shield, Calendar, Mail, LogOut, RefreshCw } from 'lucide-react';

export function PlatformProfilePage() {
  const { user, logout, refreshUser } = useAuth();

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-400">
        <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No user data available</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Your platform administrator profile</p>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user.fullName}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={refreshUser} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Full Name</p>
            <p className="font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" />{user.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="font-medium flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Role</p>
            <p className="font-medium flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-gray-400" /><span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{user.role}</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Member Since</p>
            <p className="font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Account ID</p>
            <p className="font-medium text-xs font-mono text-gray-500">{user.id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Login</p>
            <p className="font-medium">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Session</h3>
        <p className="text-sm text-gray-600">You are logged into the Platform Portal. Your session is managed via JWT tokens with automatic refresh. Log out from the button above when finished.</p>
      </div>
    </div>
  );
}

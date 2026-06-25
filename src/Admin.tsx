import React, { useState, useEffect } from 'react';
import { getWaitlistUsers, initAuth, googleSignIn, logout, getAccessToken } from './firebase';
import { User } from 'firebase/auth';

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Google Sheets state
  const [sheetId, setSheetId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');

  useEffect(() => {
    initAuth(
      (user, t) => {
        setAuthUser(user);
        setToken(t);
        if (user.email === 'admin@studyweb.com' || user.email?.includes('admin')) {
            fetchUsers();
        } else {
            setLoading(false);
        }
      },
      () => setLoading(false)
    );
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getWaitlistUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const syncToSheets = async () => {
    if (!token || !sheetId) return;
    setSyncing(true);
    setSyncResult('');
    try {
      const dataToSync = users.map(u => [
        u.firstName,
        u.lastName,
        u.email,
        u.gradeClass,
        u.country,
        u.notify ? 'Yes' : 'No',
        u.created_at?.toDate().toISOString() || new Date().toISOString()
      ]);

      const body = {
        values: [
          ['First Name', 'Last Name', 'Email', 'Grade/Class', 'Country', 'Notify', 'Timestamp'],
          ...dataToSync
        ]
      };

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:G1000?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(await res.text());
      setSyncResult('Successfully synced to Google Sheets!');
    } catch (err: any) {
      console.error(err);
      setSyncResult(`Failed to sync: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogin = async () => {
      try {
          await googleSignIn();
      } catch (err) { }
  }

  if (loading) return <div className="p-10 text-center font-sans">Loading...</div>;

  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full text-center">
            <h1 className="text-2xl font-bold mb-6 text-slate-900">Admin Login</h1>
            <button onClick={handleLogin} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition">
              Sign in with Google
            </button>
        </div>
      </div>
    );
  }

  // Not strictly enforcing 'admin@studyweb.com' since it's a prototype sandbox, 
  // but let's encourage it.
  
  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500 text-sm">Logged in as {authUser.email}</p>
          </div>
          <button onClick={logout} className="text-sm font-semibold text-slate-500 hover:text-red-500">Log out</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Total Registrations</h3>
            <div className="text-4xl font-black text-indigo-600">{users.length}</div>
          </div>
          
          <div className="col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-4">Sync to Google Sheets</h3>
            <div className="flex gap-3">
              <input 
                value={sheetId}
                onChange={e => setSheetId(e.target.value)}
                placeholder="Enter Spreadsheet ID"
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <button 
                onClick={syncToSheets} 
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
                disabled={syncing || !sheetId}
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
            {syncResult && <p className="text-sm mt-2 text-indigo-600 font-medium">{syncResult}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Recent Registrations</h3>
                <input 
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Email</th>
                    <th className="px-6 py-3 font-semibold">Grade</th>
                    <th className="px-6 py-3 font-semibold">Country</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">{user.firstName} {user.lastName}</td>
                      <td className="px-6 py-4 text-slate-600">{user.email}</td>
                      <td className="px-6 py-4 text-slate-600">{user.gradeClass}</td>
                      <td className="px-6 py-4 text-slate-600">{user.country}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {user.created_at ? new Date(user.created_at.toMillis()).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <div className="p-8 text-center text-slate-500">No registrations found.</div>}
            </div>
        </div>
      </div>
    </div>
  );
}

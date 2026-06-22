import React, { createContext, useContext, useState } from 'react';
export type Role = 'public' | 'scorer' | 'admin';
const Ctx = createContext<{ role: Role; pass: string; setAuth: (r: Role, p: string) => void }>({ role: 'public', pass: '', setAuth: () => {} });
export const ManageProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<Role>('public');
  const [pass, setPass] = useState('');
  return <Ctx.Provider value={{ role, pass, setAuth: (r, p) => { setRole(r); setPass(p); } }}>{children}</Ctx.Provider>;
};
export const useManage = () => useContext(Ctx);

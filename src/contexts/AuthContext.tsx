import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { googleSheetsService } from '../services/googleSheets';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analista' | 'entrevistador';
  active: boolean;
  password?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  isAnalyst: () => boolean;
  isInterviewer: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar se há usuário salvo no localStorage
  useEffect(() => {
    checkStoredUser();
  }, []);

  async function checkStoredUser() {
    try {
      setLoading(true);
      const storedUser = localStorage.getItem('currentUser');

      if (storedUser) {
        const userData: User = JSON.parse(storedUser);

        const freshUser = await googleSheetsService.getUserById(userData.id);

        if (freshUser && freshUser.active) {
          setUser(freshUser);
        } else {
          localStorage.removeItem('currentUser');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Erro ao verificar usuário armazenado:', error);
      localStorage.removeItem('currentUser');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      setLoading(true);

      console.log('═'.repeat(60));
      console.log('🔐 INICIANDO LOGIN');
      console.log('═'.repeat(60));
      console.log('📧 Email:', email);

      const userData = await googleSheetsService.getUserByEmail(email.toLowerCase().trim());
      console.log('📥 Dados do Google Sheets:', JSON.stringify(userData, null, 2));

      if (!userData) {
        throw new Error('Usuário não encontrado');
      }

      if (!userData.active) {
        throw new Error('Usuário inativo');
      }

      const cleanRole = String(userData.role).toLowerCase().trim();

      const userWithoutPassword: User = {
        id: userData.email,
        email: userData.email,
        name: userData.name,
        role: cleanRole as 'admin' | 'analista' | 'entrevistador',
        active: userData.active
      };

      console.log('✅ LOGIN BEM-SUCEDIDO');
      console.log('🎭 Role:', userWithoutPassword.role);
      console.log('═'.repeat(60));

      setUser(userWithoutPassword);
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));

    } catch (error) {
      console.error('❌ Erro no login:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setLoading(true);
      setUser(null);
      localStorage.removeItem('currentUser');
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setLoading(false);
    }
  }

  function isAdmin(): boolean {
    return user?.role === 'admin';
  }

  function isAnalyst(): boolean {
    return user?.role === 'analista';
  }

  function isInterviewer(): boolean {
    return user?.role === 'entrevistador';
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isAnalyst, isInterviewer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


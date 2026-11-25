import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { RoleProvider } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationProvider } from '../context/NotificationContext';

export function renderWithProviders(ui, { route = '/', ...renderOptions } = {}) {
  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <RoleProvider>
            <UIProvider>
              <NotificationProvider>
                {children}
              </NotificationProvider>
            </UIProvider>
          </RoleProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';

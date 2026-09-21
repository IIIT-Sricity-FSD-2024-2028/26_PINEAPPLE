import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { RoleProvider } from "./context/RoleContext";
import { UIProvider } from "./context/UIContext";
import { NotificationProvider } from "./context/NotificationContext";

function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <UIProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </UIProvider>
      </RoleProvider>
    </AuthProvider>
  );
}

export default App;
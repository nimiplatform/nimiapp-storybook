import { AuthProvider } from './app-shell/auth-provider.js';
import { ShellLayout } from './app-shell/shell-layout.js';
import { ProductArea } from './routes/product-area.js';

export function App() {
  return (
    <AuthProvider>
      <ShellLayout>
        <ProductArea />
      </ShellLayout>
    </AuthProvider>
  );
}

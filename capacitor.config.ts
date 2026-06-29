import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leverads.optimizer',
  appName: 'Leverads',
  webDir: 'dist',
  // Adicione o bloco server abaixo para corrigir o redirecionamento
  server: {
    iosScheme: 'com.leverads.optimizer',
    hostname: 'app.leverads.io'
  }
};

export default config;
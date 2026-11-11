
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#101318" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#101318' },
        }}
      />
    </>
  );
}

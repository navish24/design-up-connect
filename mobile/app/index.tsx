import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' }}>
        <ActivityIndicator color="#00B4B4" />
      </View>
    );
  }

  // PLACEHOLDER: mock user is always set, so this always goes to (app)
  // In production: if no session → redirect to (auth)/welcome
  if (!user) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href="/(app)" />;
}

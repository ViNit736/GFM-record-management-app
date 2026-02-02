import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { COLORS } from '../constants/colors';
import { login } from '../services/auth.service';

const { width, height } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const passwordRef = React.useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your PRN, Email or ID');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const user = await login(identifier, password);

      if (user) {
        if (user.role === 'student') router.replace('/student/dashboard');
        else if (user.role === 'teacher') router.replace('/teacher/dashboard');
        else if (user.role === 'admin') router.replace('/admin/dashboard');
        else if (user.role === 'attendance_taker') router.replace('/attendance-taker/dashboard');
      }
    } catch (error: any) {
      const msg = error.message || 'Invalid credentials';
      if (msg.includes('User not found')) {
        Alert.alert('Login Failed', 'Incorrect username. Please check your PRN/Email.');
      } else if (msg.includes('Invalid password')) {
        Alert.alert('Login Failed', 'Incorrect password. Please try again.');
      } else {
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.contentWrapper}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Image source={require('../assets/images/left.png')} style={styles.sideImage} resizeMode="contain" />
              <View style={styles.centerContent}>
                <View style={styles.logoContainer}>
                  <Ionicons name="shield-checkmark" size={60} color="#fff" />
                </View>
                <Text style={styles.logo}>GFM Record</Text>
                <Text style={styles.subtitle}>Management System</Text>
              </View>
              <Image source={require('../assets/images/right.png')} style={styles.sideImage} resizeMode="contain" />
            </View>
            <View style={styles.divider} />
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.instructionText}>Sign in to continue to your account</Text>

            {/* Identifier Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PRN / Email / ID</Text>
              <View style={[
                styles.inputContainer,
                focusedInput === 'identifier' && styles.inputContainerFocused
              ]}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={focusedInput === 'identifier' ? '#667eea' : '#999'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your PRN, Email or ID"
                  placeholderTextColor="#999"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('identifier')}
                  onBlur={() => setFocusedInput(null)}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                  disableFullscreenUI={true}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[
                styles.inputContainer,
                focusedInput === 'password' && styles.inputContainerFocused
              ]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedInput === 'password' ? '#667eea' : '#999'}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  disableFullscreenUI={true}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPass}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <View style={[styles.loginButtonContent, loading && { backgroundColor: COLORS.border }]}>
                {loading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={20} color={COLORS.white} style={{ marginLeft: 8 }} />
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* Quick Access Info */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#667eea" />
              <Text style={styles.infoText}>
                Students: Use your PRN as password for first login
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2024 GFM Record Management</Text>
            <Text style={styles.footerSubtext}>Secure • Reliable • Efficient</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  centerContent: {
    alignItems: 'center',
  },
  sideImage: {
    width: 60,
    height: 60,
    opacity: 0.9,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginTop: 15,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    elevation: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 15,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  eyeButton: {
    padding: 8,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginBottom: 25,
    marginTop: -5,
  },
  forgotText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  loginButtonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: 20,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  footerSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
});

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.logo}>📚</Text>
        <Text style={styles.title}>GFM Records</Text>
        <Text style={styles.subtitle}>
          Student Information Management System
        </Text>
      </View>

      {/* Features Section */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>👨‍🎓</Text>
          <Text style={styles.featureTitle}>Student Portal</Text>
          <Text style={styles.featureText}>
            Manage your academic records and personal information
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>👨‍🏫</Text>
          <Text style={styles.featureTitle}>Faculty Portal</Text>
          <Text style={styles.featureText}>
            Access and manage student information securely
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📊</Text>
          <Text style={styles.featureTitle}>Easy Management</Text>
          <Text style={styles.featureText}>
            Track academic records, attendance, and more
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Text style={styles.sectionTitle}>Get Started</Text>

        {/* Student Section */}
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>For Students</Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/login?role=student' as any)}
          >
            <Text style={styles.buttonText}>Student Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/signup' as any)}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Teacher Section */}
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>For Faculty</Text>
          <TouchableOpacity
            style={[styles.button, styles.teacherButton]}
            onPress={() => router.push('/login?role=teacher' as any)}
          >
            <Text style={styles.buttonText}>Faculty Login</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Secure • Fast • Reliable
        </Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  contentContainer: {
    flexGrow: 1,
    padding: 24
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30
  },
  logo: {
    fontSize: 80,
    marginBottom: 16
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20
  },
  featuresContainer: {
    marginVertical: 30
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center'
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 12
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20
  },
  buttonContainer: {
    marginTop: 20
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center'
  },
  roleSection: {
    marginBottom: 30
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center'
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12
  },
  primaryButton: {
    backgroundColor: '#007AFF'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF'
  },
  teacherButton: {
    backgroundColor: '#34C759'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8
  },
  versionText: {
    fontSize: 12,
    color: '#ccc'
  }
});
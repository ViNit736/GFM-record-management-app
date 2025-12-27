import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllDocuments } from '../../storage/sqlite';
import { getSession } from '../../services/session.service';

const CATEGORIES = ['All', 'Fees', 'Achievement', 'Course', 'Co-curricular', 'Extra-curricular', 'Internship'];

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const router = useRouter();

  const loadDocuments = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const data = await getAllDocuments(session.prn);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const filteredDocs = selectedCategory === 'All' 
    ? documents 
    : documents.filter(doc => doc.category === selectedCategory);

  const openDocument = (uri: string) => {
    if (!uri) return;
    Linking.openURL(uri).catch(err => {
      console.error("Couldn't load page", err);
      if (Platform.OS === 'web') alert('Could not open document link');
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#607D8B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents Repository</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.filterTab, selectedCategory === cat && styles.filterTabActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterTabText, selectedCategory === cat && styles.filterTabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredDocs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>No documents found for {selectedCategory}</Text>
          </View>
        ) : (
          filteredDocs.map((doc, index) => (
            <TouchableOpacity key={index} style={styles.docCard} onPress={() => openDocument(doc.uri)}>
              <View style={styles.docIconContainer}>
                <Ionicons 
                  name={doc.category === 'Fees' ? 'receipt' : 'document-text'} 
                  size={32} 
                  color="#607D8B" 
                />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                <Text style={styles.docDetails}>{doc.details}</Text>
                <Text style={styles.docDate}>{new Date(doc.date).toLocaleDateString()}</Text>
              </View>
              <Ionicons name="open-outline" size={20} color="#607D8B" />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    backgroundColor: '#607D8B',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f2f5'
  },
  filterTabActive: {
    backgroundColor: '#607D8B'
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  filterTabTextActive: {
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16
  },
  emptyText: {
    fontSize: 16,
    color: '#666'
  },
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  docIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f0f4f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  docInfo: {
    flex: 1
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2
  },
  docDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  docDate: {
    fontSize: 10,
    color: '#999'
  }
});
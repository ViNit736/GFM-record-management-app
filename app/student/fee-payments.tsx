import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FeePayment,
  getFeePayments,
  saveFeePayment,
  getTotalFeeForYear,
  getNextInstallmentNumber,
  getStudentInfo
} from '../../storage/sqlite';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { Ionicons } from '@expo/vector-icons';

export default function FeePaymentScreen() {
  const [prn, setPrn] = useState('');
  const [category, setCategory] = useState('');
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState('');

  // Form fields
  const [academicYear, setAcademicYear] = useState('1st Year');
  const [totalFee, setTotalFee] = useState('');
  const [totalFeeLocked, setTotalFeeLocked] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [receiptUri, setReceiptUri] = useState('');
  const [receiptFileInfo, setReceiptFileInfo] = useState<{ name: string, type: string } | null>(null);

  const academicYears = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const paymentModes = ['Cash', 'Cheque', 'UPI', 'Net Banking', 'Card'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userPrn = await AsyncStorage.getItem('userPrn');
      if (!userPrn) return;

      setPrn(userPrn);
      const student = await getStudentInfo(userPrn);
      if (student) {
        setCategory(student.category);
      }

      const paymentData = await getFeePayments(userPrn);
      setPayments(paymentData);
    } catch (error) {
      console.error('Error loading fee data:', error);
      Alert.alert('Error', 'Failed to load fee payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = async (year: string) => {
    setAcademicYear(year);
    
    // Check if total fee is already set for this year
    const existingTotalFee = await getTotalFeeForYear(prn, year);
    if (existingTotalFee) {
      setTotalFee(existingTotalFee.toString());
      setTotalFeeLocked(true);
    } else {
      setTotalFee('');
      setTotalFeeLocked(false);
    }
  };

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      });

    if (result.assets && result.assets[0]) {
      const file = result.assets[0];
      
      // Check file size (max 1MB)
      if (file.size && file.size > 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 1MB');
        return;
      }

      setReceiptUri(file.uri);
      setReceiptFileInfo({
        name: file.name || 'receipt.jpg',
        type: file.mimeType || 'image/jpeg'
      });
      Alert.alert('Success', 'Receipt selected successfully');
    }

    } catch (error) {
      console.error('Error picking receipt:', error);
      Alert.alert('Error', 'Failed to upload receipt');
    }
  };

  const validatePayment = (): boolean => {
    if (!totalFee || parseFloat(totalFee) <= 0) {
      Alert.alert('Error', 'Please enter valid total fee');
      return false;
    }

    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return false;
    }

    const paid = parseFloat(amountPaid);
    const total = parseFloat(totalFee);

    // Calculate total paid so far for this year
    const yearPayments = payments.filter(p => p.academicYear === academicYear);
    const totalPaidSoFar = yearPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remaining = total - totalPaidSoFar;

    if (paid > remaining) {
      Alert.alert('Error', `Amount exceeds remaining balance of ₹${remaining.toFixed(2)}`);
      return false;
    }

    if (!receiptUri) {
      Alert.alert('Warning', 'Receipt not uploaded. Continue anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => savePayment() }
      ]);
      return false;
    }

    return true;
  };

  const savePayment = async () => {
    if (!validatePayment()) return;

    setLoading(true);
    try {
      const paid = parseFloat(amountPaid);
      const total = parseFloat(totalFee);

        let finalReceiptUri = receiptUri;
        if (receiptUri && (receiptUri.startsWith('file://') || receiptUri.startsWith('blob:') || receiptUri.startsWith('data:'))) {
          const uploadedUrl = await uploadToCloudinary(
            receiptUri,
            receiptFileInfo?.type || 'image/jpeg',
            receiptFileInfo?.name || 'receipt.jpg'
          );
          
          if (uploadedUrl) {
            finalReceiptUri = uploadedUrl;
          } else {
            // If upload failed, we shouldn't save with a local URI that might not persist or is too large
            Alert.alert('Upload Failed', 'Failed to upload receipt to cloud. Please try again.');
            setLoading(false);
            return;
          }
        }

      // Calculate remaining balance
      const yearPayments = payments.filter(p => p.academicYear === academicYear);
      const totalPaidSoFar = yearPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remaining = total - totalPaidSoFar - paid;

      // Get next installment number
      const installmentNumber = await getNextInstallmentNumber(prn, academicYear);

      const payment: FeePayment = {
        prn,
        academicYear,
        category,
        totalFee: total,
        installmentNumber,
        paymentDate,
        amountPaid: paid,
        remainingBalance: remaining,
        paymentMode,
        receiptUri: finalReceiptUri
      };

      await saveFeePayment(payment);
      
      Alert.alert('Success', 'Payment recorded successfully!');
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setAmountPaid('');
    setReceiptUri('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const getPaymentStatus = (payment: FeePayment): string => {
    if (payment.remainingBalance === 0) return '✅ Paid';
    if (payment.remainingBalance < payment.totalFee) return '⚠️ Partial';
    return '❌ Unpaid';
  };

  const viewReceipt = (uri: string) => {
    setSelectedReceipt(uri);
    setReceiptModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading fee payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fee Payments</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Payment Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Payment</Text>

            {/* Academic Year */}
            <Text style={styles.label}>Academic Year *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={academicYear}
                onValueChange={handleYearChange}
                style={styles.picker}
              >
                {academicYears.map(year => (
                  <Picker.Item key={year} label={year} value={year} />
                ))}
              </Picker>
            </View>

            {/* Total Fee */}
            <Text style={styles.label}>Total Fee (₹) *</Text>
            <TextInput
              style={[styles.input, totalFeeLocked && styles.inputDisabled]}
              value={totalFee}
              onChangeText={setTotalFee}
              keyboardType="numeric"
              placeholder="Enter total fee"
              editable={!totalFeeLocked}
            />
            {totalFeeLocked && (
              <Text style={styles.helperText}>
                Total fee is locked for this year
              </Text>
            )}

            {/* Payment Date */}
            <Text style={styles.label}>Payment Date *</Text>
            <TextInput
              style={styles.input}
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder="YYYY-MM-DD"
            />

            {/* Amount Paid */}
            <Text style={styles.label}>Amount Paid (₹) *</Text>
            <TextInput
              style={styles.input}
              value={amountPaid}
              onChangeText={setAmountPaid}
              keyboardType="numeric"
              placeholder="Enter amount"
            />

            {/* Payment Mode */}
            <Text style={styles.label}>Payment Mode *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={paymentMode}
                onValueChange={setPaymentMode}
                style={styles.picker}
              >
                {paymentModes.map(mode => (
                  <Picker.Item key={mode} label={mode} value={mode} />
                ))}
              </Picker>
            </View>

            {/* Receipt Upload */}
            <Text style={styles.label}>Receipt Upload</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickReceipt}>
              <Ionicons name="cloud-upload-outline" size={24} color="#4CAF50" />
              <Text style={styles.uploadText}>
                {receiptUri ? 'Receipt Uploaded ✓' : 'Upload Receipt'}
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={savePayment}>
              <Text style={styles.submitText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment History */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Payment History</Text>

          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyText}>No payments recorded yet</Text>
            </View>
          ) : (
            payments.map((payment, index) => (
              <View key={index} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentYear}>{payment.academicYear}</Text>
                    <View style={styles.statusGroup}>
                      <Text style={[styles.verificationStatus, payment.verificationStatus === 'Verified' ? styles.verifiedText : styles.pendingText]}>
                        {payment.verificationStatus || 'Pending'}
                      </Text>
                      <Text style={styles.paymentStatus}>
                        {getPaymentStatus(payment)}
                      </Text>
                    </View>
                  </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Installment:</Text>
                  <Text style={styles.paymentValue}>#{payment.installmentNumber}</Text>
                </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Total Fee:</Text>
                  <Text style={styles.paymentValue}>₹{payment.totalFee.toFixed(2)}</Text>
                </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Amount Paid:</Text>
                  <Text style={[styles.paymentValue, styles.amountPaid]}>
                    ₹{payment.amountPaid.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Remaining:</Text>
                  <Text style={[styles.paymentValue, styles.remaining]}>
                    ₹{payment.remainingBalance.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Date:</Text>
                  <Text style={styles.paymentValue}>{payment.paymentDate}</Text>
                </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Mode:</Text>
                  <Text style={styles.paymentValue}>{payment.paymentMode}</Text>
                </View>

                {payment.receiptUri && (
                  <TouchableOpacity
                    style={styles.viewReceiptButton}
                    onPress={() => viewReceipt(payment.receiptUri)}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#4CAF50" />
                    <Text style={styles.viewReceiptText}>View Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Receipt Modal */}
      <Modal
        visible={receiptModalVisible}
        transparent={true}
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setReceiptModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            
            {selectedReceipt.endsWith('.pdf') ? (
              <Text style={styles.pdfText}>PDF Preview Not Available</Text>
            ) : (
              <Image
                source={{ uri: selectedReceipt }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  header: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 10,
    borderRadius: 50
  },
  content: {
    flex: 1,
    padding: 16
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999'
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden'
  },
  picker: {
    height: 50
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    gap: 8
  },
  uploadText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  historyCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 12
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  paymentCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50'
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  paymentYear: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
    paymentStatus: {
      fontSize: 14,
      fontWeight: '600'
    },
    statusGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    verificationStatus: {
      fontSize: 12,
      fontWeight: 'bold',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: '#f0f0f0'
    },
    verifiedText: {
      color: '#4CAF50',
      backgroundColor: '#E8F5E9'
    },
    pendingText: {
      color: '#FF9800',
      backgroundColor: '#FFF3E0'
    },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666'
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  amountPaid: {
    color: '#4CAF50'
  },
  remaining: {
    color: '#FF9800'
  },
  viewReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    gap: 6
  },
  viewReceiptText: {
    color: '#4CAF50',
    fontWeight: '600'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 12
  },
  receiptImage: {
    width: '100%',
    height: '100%'
  },
  pdfText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 18,
    color: '#666'
  }
});
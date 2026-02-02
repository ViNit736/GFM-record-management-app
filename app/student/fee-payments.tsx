import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { getSession } from '../../services/session.service';
import {
  FeePayment,
  getFeePayments,
  getNextInstallmentNumber,
  getStudentInfo,
  getTotalFeeForYear,
  saveFeePayment
} from '../../storage/sqlite';

export default function FeePaymentsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const [prn, setPrn] = useState('');
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [academicYear, setAcademicYear] = useState('2024-25');
  const [totalFee, setTotalFee] = useState('');
  const [totalFeeLocked, setTotalFeeLocked] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [category, setCategory] = useState('Open');
  const [receiptUri, setReceiptUri] = useState('');
  const [receiptFileInfo, setReceiptFileInfo] = useState<{ name: string, type: string } | null>(null);

  const [selectedReceipt, setSelectedReceipt] = useState('');
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  const academicYears = ['2023-24', '2024-25', '2025-26'];
  const paymentModes = ['Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'Demand Draft'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session || !session.prn) {
        Alert.alert('Session Error', 'Please login again');
        return;
      }

      const userPrn = session.prn;
      setPrn(userPrn);

      const feePayments = await getFeePayments(userPrn);
      setPayments(feePayments);

      const currentYear = academicYear;
      const total = await getTotalFeeForYear(userPrn, currentYear);
      setTotalFee(total?.toString() || '0');

      const nextInstallment = await getNextInstallmentNumber(userPrn, currentYear);
      // Assuming setInstallmentNumber state exists or needs to be added if used elsewhere
      // For now, I'll just set the category from student info as per original logic
      const sInfo = await getStudentInfo(userPrn);
      if (sInfo) {
        setCategory(sInfo.category || 'Open');
      }

    } catch (error) {
      console.error('Error loading fee data:', error);
      Alert.alert('Error', 'Failed to load fee payments');
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

  const viewReceipt = (uri: string) => {
    if (!uri) return;
    const isPdf = uri.toLowerCase().endsWith('.pdf') || uri.includes('/raw/upload/');
    if (isPdf) {
      Linking.openURL(uri).catch(err => {
        console.error("Error opening PDF:", err);
        Alert.alert("Error", "Could not open PDF. Please try again.");
      });
    } else {
      setSelectedReceipt(uri);
      setReceiptModalVisible(true);
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

        if (file.size && file.size > 2 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 2MB');
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
      Alert.alert('Error', 'Failed to pick receipt');
    }
  };

  const validatePayment = (): boolean => {
    if (!totalFee || parseFloat(totalFee) <= 0) {
      Alert.alert('Error', 'Please enter valid total fee');
      return false;
    }

    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      Alert.alert('Error', 'Please enter valid amount paid');
      return false;
    }

    const paid = parseFloat(amountPaid);
    const total = parseFloat(totalFee);

    const yearPayments = payments.filter(p => p.academicYear === academicYear);
    const totalPaidSoFar = yearPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remaining = total - totalPaidSoFar;

    if (paid > remaining) {
      Alert.alert('Error', `Amount exceeds remaining balance of ₹${remaining.toFixed(2)}`);
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
          receiptFileInfo?.name || 'receipt.jpg',
          'fees_gfm'
        );

        if (uploadedUrl) {
          finalReceiptUri = uploadedUrl;
        } else {
          Alert.alert('Upload Failed', 'Failed to upload receipt. Please try again.');
          setLoading(false);
          return;
        }
      }

      const yearPayments = payments.filter(p => p.academicYear === academicYear);
      const totalPaidSoFar = yearPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remaining = total - totalPaidSoFar - paid;

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
      Alert.alert('Error', 'Failed to save payment');
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
    if (payment.remainingBalance <= 0) return 'Paid';
    return 'Partial';
  };

  const styles = createStyles(width, isLargeScreen);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading fee payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fee Architecture</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowForm(!showForm)}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={isLargeScreen ? { maxWidth: 1000, alignSelf: 'center', width: '100%' } : undefined}>
        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="card-outline" size={24} color={COLORS.primary} />
              <Text style={styles.formTitle}>Add New Payment</Text>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, isLargeScreen && { flex: 1 }]}>
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
              </View>

              <View style={[styles.formField, isLargeScreen && { flex: 1 }]}>
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
                  <Text style={styles.helperText}>Total fee is locked for this year</Text>
                )}
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, isLargeScreen && { flex: 1 }]}>
                <Text style={styles.label}>Payment Date *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={[styles.formField, isLargeScreen && { flex: 1 }]}>
                <Text style={styles.label}>Amount Paid (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                />
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, isLargeScreen && { flex: 1 }]}>
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
              </View>

              <View style={[styles.formField, isLargeScreen && { flex: 1 }]}>
                <Text style={styles.label}>Receipt Upload</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={pickReceipt}>
                  <Ionicons name={receiptUri ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={receiptUri ? COLORS.success : COLORS.primary} />
                  <Text style={[styles.uploadText, receiptUri && { color: COLORS.success }]}>
                    {receiptUri ? 'Receipt Selected' : 'Upload Receipt'}
                  </Text>
                </TouchableOpacity>

                {!!receiptUri && (
                  <TouchableOpacity
                    style={styles.previewButton}
                    onPress={() => viewReceipt(receiptUri)}
                  >
                    <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.previewText}>Preview Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={savePayment}>
              <Text style={styles.submitText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Ionicons name="time-outline" size={22} color={COLORS.primary} />
            <Text style={styles.historyTitle}>Payment History</Text>
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="card-outline" size={48} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyText}>No payments recorded yet</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowForm(true)}>
                <Text style={styles.emptyAddText}>Add your first payment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.paymentsList}>
              {payments.map((payment, index) => (
                <View key={index} style={styles.paymentCard}>
                  <View style={styles.paymentCardHeader}>
                    <View>
                      <Text style={styles.paymentYear}>{payment.academicYear}</Text>
                      <Text style={styles.paymentDate}>{payment.paymentDate}</Text>
                    </View>
                    <View style={styles.statusBadges}>
                      <View style={[styles.badge, payment.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                        <Text style={[styles.badgeText, payment.verificationStatus === 'Verified' ? styles.verifiedText : styles.pendingText]}>
                          {payment.verificationStatus || 'Pending'}
                        </Text>
                      </View>
                      <View style={[styles.badge, payment.remainingBalance <= 0 ? styles.paidBadge : styles.partialBadge]}>
                        <Text style={[styles.badgeText, payment.remainingBalance <= 0 ? styles.paidText : styles.partialText]}>
                          {getPaymentStatus(payment)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.paymentInfoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Installment</Text>
                      <Text style={styles.infoValue}>#{payment.installmentNumber}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Total Fee</Text>
                      <Text style={styles.infoValue}>₹{payment.totalFee.toLocaleString()}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Paid</Text>
                      <Text style={[styles.infoValue, { color: COLORS.success }]}>₹{payment.amountPaid.toLocaleString()}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Balance</Text>
                      <Text style={[styles.infoValue, { color: COLORS.error }]}>₹{payment.remainingBalance.toLocaleString()}</Text>
                    </View>
                  </View>

                  <View style={styles.paymentFooter}>
                    <View style={styles.modeContainer}>
                      <Ionicons name="wallet-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.modeText}>{payment.paymentMode}</Text>
                    </View>
                    {!!payment.receiptUri && (
                      <TouchableOpacity
                        style={styles.viewReceiptButton}
                        onPress={() => viewReceipt(payment.receiptUri!)}
                      >
                        <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.viewReceiptText}>View Receipt</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={receiptModalVisible}
        transparent={true}
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fee Receipt</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setReceiptModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptContainer}>
              {selectedReceipt.toLowerCase().endsWith('.pdf') ? (
                <View style={styles.pdfPlaceholder}>
                  <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
                  <Text style={styles.pdfText}>PDF View not available in preview</Text>
                  <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(selectedReceipt)}>
                    <Text style={styles.downloadBtnText}>Open PDF</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Image
                  source={{ uri: selectedReceipt }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (width: number, isLargeScreen: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 16, color: COLORS.textSecondary },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  content: { flex: 1, padding: 20, marginTop: -25 },
  formCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 10 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  formGrid: { flexDirection: isLargeScreen ? 'row' : 'column', gap: 16, marginBottom: 16 },
  formField: { marginBottom: 0 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white
  },
  inputDisabled: { backgroundColor: COLORS.background, color: COLORS.textLight, borderColor: COLORS.borderLight },
  helperText: { fontSize: 12, color: COLORS.textLight, marginTop: 6, fontStyle: 'italic' },
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.white
  },
  picker: { height: 50 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    backgroundColor: `${COLORS.primary}05`
  },
  uploadText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`
  },
  previewText: { marginLeft: 8, color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  historyCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyText: { fontSize: 16, color: COLORS.textLight, marginBottom: 20 },
  emptyAddButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`
  },
  emptyAddText: { color: COLORS.primary, fontWeight: '600' },
  paymentsList: { gap: 16 },
  paymentCard: {
    backgroundColor: COLORS.background,
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  paymentYear: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  paymentDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statusBadges: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  verifiedBadge: { backgroundColor: `${COLORS.success}15` },
  verifiedText: { color: COLORS.success },
  pendingBadge: { backgroundColor: `${COLORS.warning}15` },
  pendingText: { color: COLORS.warning },
  paidBadge: { backgroundColor: `${COLORS.success}15` },
  paidText: { color: COLORS.success },
  partialBadge: { backgroundColor: `${COLORS.warning}15` },
  partialText: { color: COLORS.warning },
  paymentInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16
  },
  infoItem: { flex: 1, minWidth: '45%' },
  infoLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  modeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  viewReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 8,
    gap: 6
  },
  viewReceiptText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 600, maxHeight: '80%', backgroundColor: COLORS.white, borderRadius: 24, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeButton: { padding: 4 },
  receiptContainer: { padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  receiptImage: { width: '100%', height: 400 },
  pdfPlaceholder: { alignItems: 'center', gap: 16 },
  pdfText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  downloadBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  downloadBtnText: { color: COLORS.white, fontWeight: 'bold' },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.error + '10',
    marginLeft: 10,
  }
});


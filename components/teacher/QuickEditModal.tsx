import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { styles } from './dashboard.styles';

interface QuickEditModalProps {
    visible: boolean;
    onClose: () => void;
    section: string;
    editData: any;
    setEditData: (data: any) => void;
    onSave: () => void;
    isSaving: boolean;
}

export const QuickEditModal = ({ visible, onClose, section, editData, setEditData, onSave, isSaving }: QuickEditModalProps) => {

    const renderFields = () => {
        switch (section) {
            case 'Personal Information':
                return (
                    <View>
                        <TextInput style={styles.input} placeholder="Full Name" value={editData.fullName} onChangeText={t => setEditData({ ...editData, fullName: t })} />
                        <TextInput style={styles.input} placeholder="Gender" value={editData.gender} onChangeText={t => setEditData({ ...editData, gender: t })} />
                        <TextInput style={styles.input} placeholder="Religion" value={editData.religion} onChangeText={t => setEditData({ ...editData, religion: t })} />
                        <TextInput style={styles.input} placeholder="Category" value={editData.category} onChangeText={t => setEditData({ ...editData, category: t })} />
                        <TextInput style={styles.input} placeholder="Caste" value={editData.caste} onChangeText={t => setEditData({ ...editData, caste: t })} />
                        <TextInput style={styles.input} placeholder="DOB (YYYY-MM-DD)" value={editData.dob} onChangeText={t => setEditData({ ...editData, dob: t })} />
                        <TextInput style={styles.input} placeholder="Aadhar Number" value={editData.aadhar} onChangeText={t => setEditData({ ...editData, aadhar: t })} />
                    </View>
                );
            case 'Academic Status':
                return (
                    <View>
                        <TextInput style={styles.input} placeholder="PRN" value={editData.prn} editable={false} />
                        <TextInput style={styles.input} placeholder="Roll Number" value={editData.rollNo} onChangeText={t => setEditData({ ...editData, rollNo: t })} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Department" value={editData.branch} onChangeText={t => setEditData({ ...editData, branch: t })} />
                        <TextInput style={styles.input} placeholder="Year" value={editData.yearOfStudy} onChangeText={t => setEditData({ ...editData, yearOfStudy: t })} />
                        <TextInput style={styles.input} placeholder="Division" value={editData.division} onChangeText={t => setEditData({ ...editData, division: t })} />
                    </View>
                );
            case 'Contact & Address':
                return (
                    <View>
                        <TextInput style={styles.input} placeholder="Phone" value={editData.phone} onChangeText={t => setEditData({ ...editData, phone: t })} />
                        <TextInput style={styles.input} placeholder="Email" value={editData.email} onChangeText={t => setEditData({ ...editData, email: t })} />
                        <TextInput style={styles.input} placeholder="Pincode" value={editData.pincode} onChangeText={t => setEditData({ ...editData, pincode: t })} />
                        <TextInput style={[styles.input, { height: 80 }]} placeholder="Permanent Address" value={editData.permanentAddress} onChangeText={t => setEditData({ ...editData, permanentAddress: t })} multiline />
                        <TextInput style={[styles.input, { height: 80 }]} placeholder="Temporary Address" value={editData.temporaryAddress} onChangeText={t => setEditData({ ...editData, temporaryAddress: t })} multiline />
                    </View>
                );
            case 'Family Details':
                return (
                    <View>
                        <TextInput style={styles.input} placeholder="Father's Name" value={editData.fatherName} onChangeText={t => setEditData({ ...editData, fatherName: t })} />
                        <TextInput style={styles.input} placeholder="Mother's Name" value={editData.motherName} onChangeText={t => setEditData({ ...editData, motherName: t })} />
                        <TextInput style={styles.input} placeholder="Father's Occupation" value={editData.fatherOccupation} onChangeText={t => setEditData({ ...editData, fatherOccupation: t })} />
                        <TextInput style={styles.input} placeholder="Annual Income" value={editData.annualIncome} onChangeText={t => setEditData({ ...editData, annualIncome: t })} />
                        <TextInput style={styles.input} placeholder="Father's Phone" value={editData.fatherPhone} onChangeText={t => setEditData({ ...editData, fatherPhone: t })} />
                        <TextInput style={styles.input} placeholder="Mother's Phone" value={editData.motherPhone} onChangeText={t => setEditData({ ...editData, motherPhone: t })} />
                    </View>
                );
            case 'Education History':
                return (
                    <View>
                        <TextInput style={styles.input} placeholder="SSC School" value={editData.sscSchool} onChangeText={t => setEditData({ ...editData, sscSchool: t })} />
                        <TextInput style={styles.input} placeholder="SSC Marks" value={editData.sscMarks} onChangeText={t => setEditData({ ...editData, sscMarks: t })} />
                        <TextInput style={styles.input} placeholder="SSC Max Marks" value={editData.sscMaxMarks} onChangeText={t => setEditData({ ...editData, sscMaxMarks: t })} />
                        <TextInput style={styles.input} placeholder="SSC Percentage" value={editData.sscPercentage} onChangeText={t => setEditData({ ...editData, sscPercentage: t })} />
                        <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />
                        <TextInput style={styles.input} placeholder="HSC/Diploma College" value={editData.hscCollege || editData.diplomaCollege} onChangeText={t => setEditData(editData.admissionType === 'DSE' ? { ...editData, diplomaCollege: t } : { ...editData, hscCollege: t })} />
                        <TextInput style={styles.input} placeholder="HSC/Diploma Marks" value={editData.hscMarks || editData.diplomaMarks} onChangeText={t => setEditData(editData.admissionType === 'DSE' ? { ...editData, diplomaMarks: t } : { ...editData, hscMarks: t })} />
                        <TextInput style={styles.input} placeholder="HSC/Diploma Percentage" value={editData.hscPercentage || editData.diplomaPercentage} onChangeText={t => setEditData(editData.admissionType === 'DSE' ? { ...editData, diplomaPercentage: t } : { ...editData, hscPercentage: t })} />
                    </View>
                );
            default: return null;
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalBody, { maxWidth: 500, maxHeight: '80%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Quick Edit: {section}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ paddingBottom: 20 }}>
                        {editData && renderFields()}
                    </ScrollView>
                    <View style={[styles.row, { marginTop: 20 }]}>
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.btnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={onSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

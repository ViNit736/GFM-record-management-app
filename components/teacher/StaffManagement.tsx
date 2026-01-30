import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { BRANCH_MAPPINGS, getFullBranchName } from '../../constants/Mappings';
import {
    deleteAttendanceTaker,
    deleteFacultyMember,
    FacultyMember,
    getAttendanceTakers,
    getFacultyMembers,
    saveAttendanceTaker,
    saveFacultyMember
} from '../../storage/sqlite';
import { styles as dashboardStyles } from './dashboard.styles';

export const StaffManagement = () => {
    const [activeTab, setActiveTab] = useState<'faculty' | 'takers'>('faculty');
    const [loading, setLoading] = useState(true);
    const [staffList, setStaffList] = useState<FacultyMember[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newStaff, setNewStaff] = useState({
        prn: '',
        fullName: '',
        email: '',
        department: 'CSE'
    });

    const DEPARTMENTS = Object.keys(BRANCH_MAPPINGS);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = activeTab === 'faculty' ? await getFacultyMembers() : await getAttendanceTakers();
            setStaffList(data);
        } catch (error) {
            console.error('Error loading staff:', error);
            Alert.alert('Error', 'Failed to load staff data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStaff = async () => {
        if (!newStaff.prn || !newStaff.fullName || !newStaff.email || !newStaff.department) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        try {
            if (activeTab === 'faculty') {
                await saveFacultyMember(newStaff.prn, newStaff.prn, newStaff.fullName, newStaff.department, newStaff.email);
            } else {
                await saveAttendanceTaker(newStaff.prn, newStaff.prn, newStaff.fullName, newStaff.department, newStaff.email);
            }
            setModalVisible(false);
            setNewStaff({ prn: '', fullName: '', email: '', department: 'CSE' });
            loadData();
            Alert.alert('Success', `${activeTab === 'faculty' ? 'Faculty' : 'Taker'} added successfully`);
        } catch (error) {
            Alert.alert('Error', 'Failed to add staff member');
        }
    };

    const handleDeleteStaff = (prn: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to remove this ${activeTab === 'faculty' ? 'faculty' : 'taker'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (activeTab === 'faculty') {
                                await deleteFacultyMember(prn);
                            } else {
                                await deleteAttendanceTaker(prn);
                            }
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete staff member');
                        }
                    }
                }
            ]
        );
    };

    const renderStaffItem = ({ item }: { item: FacultyMember }) => (
        <View style={dashboardStyles.tableRow}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: COLORS.text }}>{item.fullName || item.prn}</Text>
                <Text style={{ fontSize: 12, color: COLORS.textLight }}>PRN: {item.prn} | {item.email}</Text>
            </View>
            <View style={{ width: 100 }}>
                <Text style={{ fontSize: 12, color: COLORS.primary }}>{getFullBranchName(item.department || '')}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteStaff(item.prn)} style={{ padding: 5 }}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={dashboardStyles.moduleCard}>
            <View style={dashboardStyles.moduleHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <Text style={dashboardStyles.moduleTitle}>Manage Staff</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 20, padding: 4 }}>
                        <TouchableOpacity
                            onPress={() => setActiveTab('faculty')}
                            style={{
                                paddingHorizontal: 15, paddingVertical: 6, borderRadius: 16,
                                backgroundColor: activeTab === 'faculty' ? COLORS.primary : 'transparent'
                            }}
                        >
                            <Text style={{ color: activeTab === 'faculty' ? '#fff' : COLORS.text, fontSize: 13, fontWeight: '600' }}>Faculty</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('takers')}
                            style={{
                                paddingHorizontal: 15, paddingVertical: 6, borderRadius: 16,
                                backgroundColor: activeTab === 'takers' ? COLORS.secondary : 'transparent'
                            }}
                        >
                            <Text style={{ color: activeTab === 'takers' ? '#fff' : COLORS.text, fontSize: 13, fontWeight: '600' }}>Takers</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    style={[dashboardStyles.actionBtn, { backgroundColor: activeTab === 'faculty' ? COLORS.primary : COLORS.secondary }]}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={dashboardStyles.actionBtnText}>Add {activeTab === 'faculty' ? 'Faculty' : 'Taker'}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
                <View style={{ marginTop: 15 }}>
                    <View style={[dashboardStyles.tableRow, dashboardStyles.tableHeader]}>
                        <Text style={{ flex: 1, color: '#fff', fontWeight: 'bold' }}>Name & Contacts</Text>
                        <Text style={{ width: 100, color: '#fff', fontWeight: 'bold' }}>Dept</Text>
                        <Text style={{ width: 30, color: '#fff' }}></Text>
                    </View>
                    <FlatList
                        data={staffList}
                        keyExtractor={(item) => item.prn}
                        renderItem={renderStaffItem}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: COLORS.textLight }}>No {activeTab} found.</Text>}
                    />
                </View>
            )}

            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ width: '90%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 20, padding: 25 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>Add {activeTab === 'faculty' ? 'Faculty' : 'Taker'}</Text>

                        <Text style={{ fontSize: 14, color: COLORS.text, marginBottom: 5 }}>Full Name</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 15 }}
                            value={newStaff.fullName}
                            onChangeText={t => setNewStaff({ ...newStaff, fullName: t })}
                        />

                        <Text style={{ fontSize: 14, color: COLORS.text, marginBottom: 5 }}>Email</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 15 }}
                            value={newStaff.email}
                            onChangeText={t => setNewStaff({ ...newStaff, email: t })}
                            keyboardType="email-address"
                        />

                        <Text style={{ fontSize: 14, color: COLORS.text, marginBottom: 5 }}>PRN / Username</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 15 }}
                            value={newStaff.prn}
                            onChangeText={t => setNewStaff({ ...newStaff, prn: t })}
                        />

                        <Text style={{ fontSize: 14, color: COLORS.text, marginBottom: 5 }}>Department</Text>
                        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 20 }}>
                            <Picker
                                selectedValue={newStaff.department}
                                onValueChange={v => setNewStaff({ ...newStaff, department: v })}
                            >
                                {DEPARTMENTS.map(d => <Picker.Item key={d} label={BRANCH_MAPPINGS[d]} value={d} />)}
                            </Picker>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10 }}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddStaff}
                                style={{ backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Member</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

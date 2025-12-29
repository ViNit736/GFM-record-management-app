import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image, KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { FormDatePicker, FormInput, FormPicker } from '../../components/FormInput';
import { BRANCH_MAPPINGS, YEAR_MAPPINGS } from '../../constants/Mappings';
import { calculatePercentage, sanitizeInput, validateStep } from '../../constants/validation';
import { markProfileComplete } from '../../services/auth.service';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { getUserPrn } from '../../services/session.service';
import { getStudentInfo, saveStudentInfo, Student } from '../../storage/sqlite';

export default function PersonalInfoForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [formData, setFormData] = useState<Student>({
    prn: '', fullName: '', gender: 'Male', religion: '', category: 'Open', caste: '',
    dob: '', branch: 'CSE', division: '', yearOfStudy: 'FE', phone: '', email: '', aadhar: '', permanentAddress: '',
    pincode: '', temporaryAddress: '', fatherName: '', motherName: '', fatherOccupation: '',
    motherOccupation: '', annualIncome: '', fatherPhone: '', motherPhone: '',
    sscSchool: '', sscMarks: '', sscMaxMarks: '', sscPercentage: '', sscYear: '',
    hscCollege: '', hscMarks: '', hscMaxMarks: '', hscPercentage: '', hscYear: '',
    diplomaCollege: '', diplomaMarks: '', diplomaMaxMarks: '', diplomaPercentage: '',
    diplomaYear: '', diplomaBranch: '', diplomaBoard: '', diplomaState: '', diplomaCity: '',
    diplomaCgpa: '', diplomaPassingMonth: '', admissionType: 'CAP Round',
    jeePercentile: '', mhtCetPercentile: '', photoUri: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const prn = await getUserPrn();
        if (!prn) {
          router.replace('/' as any);
          return;
        }
        setFormData(prev => ({ ...prev, prn }));
        const existingData = await getStudentInfo(prn);
        if (existingData) setFormData(existingData);
      } catch (e) { console.error(e); }
      finally { setInitialLoading(false); }
    };
    loadData();
  }, []);

  const updateField = (field: keyof Student, value: string, type?: 'text' | 'number' | 'decimal' | 'phone' | 'email') => {
    const sanitizedValue = type ? sanitizeInput(value, type) : value;
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // --- Percentage Calculations ---
  useEffect(() => {
    if (formData.sscMarks && formData.sscMaxMarks) {
      setFormData(prev => ({ ...prev, sscPercentage: calculatePercentage(formData.sscMarks, formData.sscMaxMarks) }));
    }
  }, [formData.sscMarks, formData.sscMaxMarks]);

  useEffect(() => {
    if (formData.hscMarks && formData.hscMaxMarks) {
      setFormData(prev => ({ ...prev, hscPercentage: calculatePercentage(formData.hscMarks, formData.hscMaxMarks) }));
    }
  }, [formData.hscMarks, formData.hscMaxMarks]);

  useEffect(() => {
    if (formData.diplomaMarks && formData.diplomaMaxMarks) {
      setFormData(prev => ({ ...prev, diplomaPercentage: calculatePercentage(formData.diplomaMarks, formData.diplomaMaxMarks) }));
    }
  }, [formData.diplomaMarks, formData.diplomaMaxMarks]);

  const handleNext = () => {
    const validation = validateStep(step, formData);
    if (!validation.isValid) {
      setErrors(validation.fieldErrors || {});
      const errorMsg = validation.errors.join("\n");
      if (Platform.OS === 'web') {
        alert("Please correct the following errors:\n" + errorMsg);
      } else {
        Alert.alert("Required Fields", errorMsg);
      }
      return;
    }
    setErrors({});
    setStep(step + 1);
  };


  const handleFinish = async () => {
    // Validate the last step (photo)
    const validation = validateStep(5, formData);
    if (!validation.isValid) {
      setErrors(validation.fieldErrors || {});
      const errorMsg = validation.errors.join("\n");
      if (Platform.OS === 'web') {
        alert("Please correct the following errors:\n" + errorMsg);
      } else {
        Alert.alert("Required Fields", errorMsg);
      }
      return;
    }

    setLoading(true);
    try {
      let finalUrl = formData.photoUri;
      if (formData.photoUri && (formData.photoUri.startsWith('file://') || formData.photoUri.startsWith('blob:') || formData.photoUri.startsWith('data:'))) {
        console.log('📤 Uploading photo...');
        const uploaded = await uploadToCloudinary(formData.photoUri, 'image/jpeg', `profile_${formData.prn}.jpg`, 'photo_gfm_record');
        if (!uploaded) {
          if (Platform.OS === 'web') {
            alert("Error: Photo upload failed. Please try again.");
          } else {
            Alert.alert("Error", "Photo upload failed. Please try again.");
          }
          setLoading(false);
          return;
        }
        finalUrl = uploaded;
        console.log('✅ Photo uploaded:', finalUrl);
      }

      const finalData = { ...formData, photoUri: finalUrl };
      console.log('📝 Saving profile data:', JSON.stringify(finalData, null, 2));

      await saveStudentInfo(finalData);
      console.log('✅ Student info saved');

      await markProfileComplete(formData.prn);
      console.log('✅ Profile marked as complete');

      await AsyncStorage.setItem('personalInfoCompleted', 'true');

      if (Platform.OS === 'web') {
        alert("Success! 🎉 Profile updated successfully.");
        router.replace('/student/dashboard' as any);
      } else {
        Alert.alert("Success! 🎉", "Profile updated successfully.", [
          { text: "Dashboard", onPress: () => router.replace('/student/dashboard' as any) }
        ]);
      }
    } catch (e: any) {
      console.error("❌ Finish Error:", e);
      if (Platform.OS === 'web') {
        alert("Error: Failed to save profile. " + (e.message || "Check connection."));
      } else {
        Alert.alert("Error", "Failed to save profile. Check connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setFormData(prev => ({ ...prev, photoUri: result.assets[0].uri }));
    }
  };

  if (initialLoading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Step {step} of 5</Text>

        <View style={styles.card}>
          {/* STEP 1: PERSONAL INFO */}
          {step === 1 && (
            <View>
              <FormInput
                label="Full Name *"
                value={formData.fullName}
                onChangeText={v => updateField('fullName', v, 'text')}
                placeholder="Enter full name"
                error={errors.fullName}
              />
              <FormPicker
                label="Gender *"
                selectedValue={formData.gender}
                onValueChange={v => updateField('gender', v)}
                items={['Male', 'Female', 'Other']}
                error={errors.gender}
              />
              <FormDatePicker
                label="Date of Birth *"
                value={formData.dob}
                onChange={v => updateField('dob', v)}
                error={errors.dob}
              />
              <FormPicker
                label="Branch *"
                selectedValue={formData.branch}
                onValueChange={v => updateField('branch', v)}
                items={Object.keys(BRANCH_MAPPINGS).map(k => ({ label: BRANCH_MAPPINGS[k], value: k }))}
                error={errors.branch}
              />
              <View style={styles.row}>
                <FormPicker
                  containerStyle={styles.halfWidth}
                  label="Year of Study *"
                  selectedValue={formData.yearOfStudy}
                  onValueChange={v => updateField('yearOfStudy', v)}
                  items={Object.keys(YEAR_MAPPINGS).filter(k => k.length === 2).map(k => ({ label: YEAR_MAPPINGS[k], value: k }))}
                  error={errors.yearOfStudy}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Division *"
                  value={formData.division}
                  onChangeText={v => updateField('division', v, 'text')}
                  placeholder="e.g., A, B, C"
                  error={errors.division}
                />
              </View>
              <FormInput
                label="Phone *"
                keyboardType="numeric"
                maxLength={10}
                value={formData.phone}
                onChangeText={v => updateField('phone', v, 'phone')}
                placeholder="10-digit mobile number"
                error={errors.phone}
              />
              <FormInput
                label="Email *"
                value={formData.email}
                onChangeText={v => updateField('email', v, 'email')}
                autoCapitalize="none"
                placeholder="email@example.com"
                error={errors.email}
              />
              <FormInput
                label="Aadhar Number (Optional)"
                keyboardType="numeric"
                maxLength={12}
                value={formData.aadhar}
                onChangeText={v => updateField('aadhar', v, 'number')}
                placeholder="12-digit Aadhar number"
                error={errors.aadhar}
              />
              <FormPicker
                label="Category *"
                selectedValue={formData.category}
                onValueChange={v => updateField('category', v)}
                items={['Open', 'OBC', 'SC', 'ST', 'NT', 'SBC']}
                error={errors.category}
              />
              <FormInput
                label="Religion (Optional)"
                value={formData.religion}
                onChangeText={v => updateField('religion', v)}
                placeholder="e.g., Hindu, Muslim, Christian"
                error={errors.religion}
              />
              <FormInput
                label="Caste (Optional)"
                value={formData.caste}
                onChangeText={v => updateField('caste', v)}
                placeholder="Enter caste if applicable"
                error={errors.caste}
              />
            </View>
          )}


          {/* STEP 2: ADDRESS & FAMILY */}
          {step === 2 && (
            <View>
              <Text style={styles.sectionTitle}>Address Details</Text>
              <FormInput
                label="Permanent Address *"
                multiline
                numberOfLines={3}
                value={formData.permanentAddress}
                onChangeText={v => updateField('permanentAddress', v)}
                placeholder="Enter complete permanent address"
                error={errors.permanentAddress}
              />
              <FormInput
                label="Pincode *"
                keyboardType="numeric"
                maxLength={6}
                value={formData.pincode}
                onChangeText={v => updateField('pincode', v, 'number')}
                placeholder="6-digit pincode"
                error={errors.pincode}
              />
              <FormInput
                label="Temporary Address (Optional)"
                multiline
                numberOfLines={3}
                placeholder="Leave blank if same as permanent"
                value={formData.temporaryAddress}
                onChangeText={v => updateField('temporaryAddress', v)}
                error={errors.temporaryAddress}
              />

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Family Details</Text>

              <FormInput
                label="Father's Name *"
                value={formData.fatherName}
                onChangeText={v => updateField('fatherName', v, 'text')}
                placeholder="Enter father's full name"
                error={errors.fatherName}
              />
              <FormInput
                label="Father's Occupation (Optional)"
                value={formData.fatherOccupation}
                onChangeText={v => updateField('fatherOccupation', v)}
                placeholder="e.g., Farmer, Teacher"
                error={errors.fatherOccupation}
              />
              <FormInput
                label="Father's Phone *"
                keyboardType="numeric"
                maxLength={10}
                value={formData.fatherPhone}
                onChangeText={v => updateField('fatherPhone', v, 'phone')}
                placeholder="10-digit mobile number"
                error={errors.fatherPhone}
              />

              <View style={{ marginVertical: 10 }} />

              <FormInput
                label="Mother's Name *"
                value={formData.motherName}
                onChangeText={v => updateField('motherName', v, 'text')}
                placeholder="Enter mother's full name"
                error={errors.motherName}
              />
              <FormInput
                label="Mother's Occupation (Optional)"
                value={formData.motherOccupation}
                onChangeText={v => updateField('motherOccupation', v)}
                placeholder="e.g., Homemaker, Teacher"
                error={errors.motherOccupation}
              />
              <FormInput
                label="Mother's Phone (Optional)"
                keyboardType="numeric"
                maxLength={10}
                value={formData.motherPhone}
                onChangeText={v => updateField('motherPhone', v, 'phone')}
                placeholder="10-digit mobile number"
                error={errors.motherPhone}
              />

              <FormInput
                label="Annual Family Income *"
                keyboardType="numeric"
                value={formData.annualIncome}
                onChangeText={v => updateField('annualIncome', v, 'number')}
                placeholder="e.g., 500000"
                error={errors.annualIncome}
              />
            </View>
          )}

          {/* STEP 3: EDUCATION (SSC, HSC, DIPLOMA) */}
          {step === 3 && (
            <View>
              {/* SSC SECTION */}
              <Text style={styles.sectionTitle}>SSC (10th Standard) *</Text>
              <FormInput
                label="School Name *"
                value={formData.sscSchool}
                onChangeText={v => updateField('sscSchool', v)}
                placeholder="Enter school name"
                error={errors.sscSchool}
              />
              <View style={styles.row}>
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Marks Obtained *"
                  keyboardType="numeric"
                  value={formData.sscMarks}
                  onChangeText={v => updateField('sscMarks', v, 'number')}
                  placeholder="e.g., 450"
                  error={errors.sscMarks}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Max Marks *"
                  keyboardType="numeric"
                  value={formData.sscMaxMarks}
                  onChangeText={v => updateField('sscMaxMarks', v, 'number')}
                  placeholder="e.g., 500"
                  error={errors.sscMaxMarks}
                />
              </View>
              <FormInput
                label="SSC Percentage (Auto-calculated)"
                value={formData.sscPercentage}
                editable={false}
                error={errors.sscPercentage}
              />
              <FormInput
                label="Passing Year *"
                keyboardType="numeric"
                maxLength={4}
                value={formData.sscYear}
                onChangeText={v => updateField('sscYear', v, 'number')}
                placeholder="e.g., 2020"
                error={errors.sscYear}
              />

              <View style={styles.divider} />

              {/* HSC SECTION */}
              <Text style={styles.sectionTitle}>HSC (12th) - Optional</Text>
              <Text style={styles.helperText}>Fill this section if you completed HSC (not diploma)</Text>
              <FormInput
                label="College Name"
                value={formData.hscCollege}
                onChangeText={v => updateField('hscCollege', v)}
                placeholder="Enter college name"
                error={errors.hscCollege}
              />
              <View style={styles.row}>
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Marks Obtained"
                  keyboardType="numeric"
                  value={formData.hscMarks}
                  onChangeText={v => updateField('hscMarks', v, 'number')}
                  placeholder="e.g., 480"
                  error={errors.hscMarks}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Max Marks"
                  keyboardType="numeric"
                  value={formData.hscMaxMarks}
                  onChangeText={v => updateField('hscMaxMarks', v, 'number')}
                  placeholder="e.g., 600"
                  error={errors.hscMaxMarks}
                />
              </View>
              <FormInput
                label="HSC Percentage (Auto-calculated)"
                value={formData.hscPercentage}
                editable={false}
                error={errors.hscPercentage}
              />
              <FormInput
                label="Passing Year"
                keyboardType="numeric"
                maxLength={4}
                value={formData.hscYear}
                onChangeText={v => updateField('hscYear', v, 'number')}
                placeholder="e.g., 2022"
                error={errors.hscYear}
              />

              <View style={styles.divider} />

              {/* DIPLOMA SECTION */}
              <Text style={styles.sectionTitle}>Diploma - Optional</Text>
              <Text style={styles.helperText}>Fill this section if you completed Diploma (not HSC)</Text>
              <FormInput
                label="Institute Name"
                value={formData.diplomaCollege}
                onChangeText={v => updateField('diplomaCollege', v)}
                placeholder="Enter institute name"
                error={errors.diplomaCollege}
              />
              <FormInput
                label="Diploma Board"
                value={formData.diplomaBoard}
                onChangeText={v => updateField('diplomaBoard', v)}
                placeholder="e.g., MSBTE"
                error={errors.diplomaBoard}
              />
              <View style={styles.row}>
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Diploma State"
                  value={formData.diplomaState}
                  onChangeText={v => updateField('diplomaState', v)}
                  placeholder="e.g., Maharashtra"
                  error={errors.diplomaState}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Diploma City"
                  value={formData.diplomaCity}
                  onChangeText={v => updateField('diplomaCity', v)}
                  placeholder="e.g., Pune"
                  error={errors.diplomaCity}
                />
              </View>
              <FormInput
                label="Diploma Branch"
                value={formData.diplomaBranch}
                onChangeText={v => updateField('diplomaBranch', v)}
                placeholder="e.g., Mechanical Engineering"
                error={errors.diplomaBranch}
              />
              <View style={styles.row}>
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Marks Obtained"
                  keyboardType="number-pad"
                  value={formData.diplomaMarks}
                  onChangeText={v => updateField('diplomaMarks', v, 'number')}
                  placeholder="e.g., 850"
                  error={errors.diplomaMarks}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Max Marks"
                  keyboardType="number-pad"
                  value={formData.diplomaMaxMarks}
                  onChangeText={v => updateField('diplomaMaxMarks', v, 'number')}
                  placeholder="e.g., 1000"
                  error={errors.diplomaMaxMarks}
                />
              </View>
              <View style={styles.row}>
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Diploma Percentage"
                  value={formData.diplomaPercentage}
                  editable={false}
                  error={errors.diplomaPercentage}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Diploma CGPA"
                  keyboardType="decimal-pad"
                  value={formData.diplomaCgpa}
                  onChangeText={v => updateField('diplomaCgpa', v, 'decimal')}
                  placeholder="e.g., 9.5"
                  error={errors.diplomaCgpa}
                />
              </View>
              <View style={styles.row}>
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Passing Month"
                  value={formData.diplomaPassingMonth}
                  onChangeText={v => updateField('diplomaPassingMonth', v)}
                  placeholder="e.g., June"
                  error={errors.diplomaPassingMonth}
                />
                <FormInput
                  containerStyle={styles.halfWidth}
                  label="Passing Year"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={formData.diplomaYear}
                  onChangeText={v => updateField('diplomaYear', v, 'number')}
                  placeholder="e.g., 2022"
                  error={errors.diplomaYear}
                />
              </View>
            </View>
          )}

          {/* STEP 4: ADMISSION */}
          {step === 4 && (
            <View>
              <FormPicker
                label="Admission Type *"
                selectedValue={formData.admissionType}
                onValueChange={v => updateField('admissionType', v)}
                items={['CAP Round', 'Management Quota', 'Direct Admission']}
                error={errors.admissionType}
              />
              <FormInput
                label="JEE Percentile (Optional)"
                keyboardType="decimal-pad"
                value={formData.jeePercentile}
                onChangeText={v => updateField('jeePercentile', v, 'decimal')}
                placeholder="e.g., 95.5"
                error={errors.jeePercentile}
              />
              <FormInput
                label="MHT-CET Percentile (Optional)"
                keyboardType="decimal-pad"
                value={formData.mhtCetPercentile}
                onChangeText={v => updateField('mhtCetPercentile', v, 'decimal')}
                placeholder="e.g., 92.3"
                error={errors.mhtCetPercentile}
              />
            </View>
          )}

          {/* STEP 5: PHOTO */}
          {step === 5 && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.photoTitle}>Upload Profile Photo *</Text>
              <TouchableOpacity onPress={pickImage} style={styles.imgPicker}>
                {formData.photoUri ? (
                  <Image source={{ uri: formData.photoUri }} style={styles.img} />
                ) : (
                  <Text style={{ color: '#2196f3', textAlign: 'center' }}>Tap to Select Photo</Text>
                )}
              </TouchableOpacity>
              {errors.photoUri && <Text style={{ color: '#f44336', marginTop: 10 }}>{errors.photoUri}</Text>}
              {loading && <ActivityIndicator style={{ marginTop: 10 }} />}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.btnBack}>
              <Text style={styles.btnText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < 5 ? (
            <TouchableOpacity onPress={handleNext} style={styles.btnNext}>
              <Text style={styles.btnTextWhite}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleFinish} style={styles.btnFinish} disabled={loading}>
              <Text style={styles.btnTextWhite}>{loading ? "Saving..." : "Finish"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 15 },
  header: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 20, color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  row: { flexDirection: 'row', gap: 10 },
  halfWidth: { flex: 1 },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#444', marginBottom: 15 },
  helperText: { fontSize: 13, color: '#666', marginBottom: 15, fontStyle: 'italic' },
  photoTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 20 },
  footer: { flexDirection: 'row', marginTop: 20, gap: 10, paddingBottom: 40 },
  btnBack: { flex: 1, height: 50, backgroundColor: '#e0e0e0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnNext: { flex: 1, height: 50, backgroundColor: '#2196f3', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnFinish: { flex: 1, height: 50, backgroundColor: '#4caf50', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#333' },
  btnTextWhite: { fontSize: 16, fontWeight: '600', color: '#fff' },
  imgPicker: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#2196f3', borderStyle: 'dashed' },
  img: { width: '100%', height: '100%' }
});

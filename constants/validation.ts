// validation.ts - Complete and corrected validation

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors?: { [key: string]: string };
}

export interface FormData {
  // Step 1: Personal Info
  prn: string;
  fullName: string;
  gender: string;
  religion: string;
  category: string;
  caste: string;
    dob: string;
    branch: string;
    division: string;
    yearOfStudy: string;
    phone: string;
  email: string;
  aadhar: string;
  
  // Step 2: Address & Family
  permanentAddress: string;
  pincode: string;
  temporaryAddress: string;
  fatherName: string;
  motherName: string;
  fatherOccupation: string;
  motherOccupation: string;
  annualIncome: string;
  fatherPhone: string;
  motherPhone: string;
  
  // Step 3: Education
  sscSchool: string;
  sscMarks: string;
  sscMaxMarks: string;
  sscPercentage: string;
  sscYear: string;
  
  // HSC (Optional)
  hscCollege: string;
  hscMarks: string;
  hscMaxMarks: string;
  hscPercentage: string;
  hscYear: string;
  
  // Diploma (Optional)
  diplomaCollege: string;
  diplomaMarks: string;
  diplomaMaxMarks: string;
  diplomaPercentage: string;
  diplomaYear: string;
  diplomaBranch: string;
  
  // Step 4: Admission Details
  admissionType: string;
  jeePercentile: string;
  mhtCetPercentile: string;
  
  // Step 5: Photo
  photoUri: string;
}

// ==================== BASIC VALIDATORS ====================

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile number
  return phoneRegex.test(phone.trim());
};

export const validateAadhar = (aadhar: string): boolean => {
  if (!aadhar) return true; // Optional field
  const aadharRegex = /^\d{12}$/;
  return aadharRegex.test(aadhar.trim());
};

export const validatePincode = (pincode: string): boolean => {
  const pincodeRegex = /^\d{6}$/;
  return pincodeRegex.test(pincode.trim());
};

export const validatePRN = (prn: string): boolean => {
  const prnRegex = /^[A-Z0-9]{10,20}$/;
  return prnRegex.test(prn.trim());
};

export const validateName = (name: string): boolean => {
  const nameRegex = /^[a-zA-Z\s]{2,50}$/;
  return nameRegex.test(name.trim());
};

export const validateYear = (year: string): boolean => {
  const currentYear = new Date().getFullYear();
  const yearNum = parseInt(year);
  return yearNum >= 1950 && yearNum <= currentYear;
};

export const validatePercentage = (percentage: string): boolean => {
  const percentNum = parseFloat(percentage);
  return !isNaN(percentNum) && percentNum >= 0 && percentNum <= 100;
};

export const validateMarks = (marks: string, maxMarks: string): boolean => {
  const marksNum = parseFloat(marks);
  const maxMarksNum = parseFloat(maxMarks);
  return !isNaN(marksNum) && !isNaN(maxMarksNum) && marksNum >= 0 && marksNum <= maxMarksNum;
};

export const validateAge = (dob: string): boolean => {
  const birthDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 15 && age - 1 <= 30;
  }
  return age >= 15 && age <= 30;
};

export const validateIncome = (income: string): boolean => {
  const incomeNum = parseFloat(income);
  return !isNaN(incomeNum) && incomeNum >= 0 && incomeNum <= 10000000;
};

export const validatePercentile = (percentile: string): boolean => {
  if (!percentile) return true; // Optional
  const percentileNum = parseFloat(percentile);
  return !isNaN(percentileNum) && percentileNum >= 0 && percentileNum <= 100;
};

// ==================== FIELD VALIDATORS ====================

export const validateField = (fieldName: string, value: string, formData?: FormData): ValidationResult => {
  const errors: string[] = [];
  
  switch (fieldName) {
    case 'prn':
      if (!value) errors.push('PRN is required');
      else if (!validatePRN(value)) errors.push('Invalid PRN format');
      break;
      
    case 'fullName':
    case 'fatherName':
    case 'motherName':
      if (!value) errors.push(`${fieldName === 'fullName' ? 'Name' : fieldName === 'fatherName' ? "Father's name" : "Mother's name"} is required`);
      else if (!validateName(value)) errors.push('Name should contain only letters (2-50 characters)');
      break;
      
    case 'phone':
    case 'fatherPhone':
    case 'motherPhone':
      if (!value && fieldName !== 'motherPhone') errors.push('Phone number is required');
      else if (value && !validatePhone(value)) errors.push('Phone must be 10 digits starting with 6-9');
      break;
      
    case 'email':
      if (!value) errors.push('Email is required');
      else if (!validateEmail(value)) errors.push('Invalid email format');
      break;
      
    case 'aadhar':
      if (value && !validateAadhar(value)) errors.push('Aadhar must be 12 digits');
      break;
      
    case 'dob':
      if (!value) errors.push('Date of birth is required');
      else if (!validateAge(value)) errors.push('Age must be between 15-30 years');
      break;
      
    case 'permanentAddress':
    case 'temporaryAddress':
      if (!value && fieldName === 'permanentAddress') errors.push('Permanent address is required');
      else if (value && value.trim().length < 10) errors.push('Address must be at least 10 characters');
      break;
      
    case 'pincode':
      if (!value) errors.push('Pincode is required');
      else if (!validatePincode(value)) errors.push('Pincode must be 6 digits');
      break;
      
    case 'annualIncome':
      if (!value) errors.push('Annual income is required');
      else if (!validateIncome(value)) errors.push('Invalid income amount');
      break;
      
    case 'sscSchool':
      if (!value) errors.push('SSC School name is required');
      else if (value.trim().length < 3) errors.push('School name must be at least 3 characters');
      break;
      
    case 'hscCollege':
    case 'diplomaCollege':
      // Optional - only validate if provided
      if (value && value.trim().length < 3) errors.push('College name must be at least 3 characters');
      break;
      
    case 'sscMarks':
    case 'hscMarks':
    case 'diplomaMarks':
      if (!value) {
        if (fieldName === 'sscMarks') errors.push('SSC marks are required');
        // HSC/Diploma marks optional if not filled
      } else if (formData) {
        const maxMarksField = fieldName === 'sscMarks' ? 'sscMaxMarks' : 
                             fieldName === 'hscMarks' ? 'hscMaxMarks' : 'diplomaMaxMarks';
        if (!validateMarks(value, formData[maxMarksField])) {
          errors.push('Marks must be valid and not exceed max marks');
        }
      }
      break;
      
    case 'sscMaxMarks':
    case 'hscMaxMarks':
    case 'diplomaMaxMarks':
      if (!value) {
        if (fieldName === 'sscMaxMarks') errors.push('SSC maximum marks are required');
        // HSC/Diploma max marks optional
      } else if (parseFloat(value) <= 0) errors.push('Maximum marks must be greater than 0');
      break;
      
    case 'sscPercentage':
    case 'hscPercentage':
    case 'diplomaPercentage':
      if (value && !validatePercentage(value)) errors.push('Percentage must be between 0-100');
      break;
      
    case 'sscYear':
    case 'hscYear':
    case 'diplomaYear':
      if (!value && fieldName === 'sscYear') errors.push('SSC year is required');
      else if (value && !validateYear(value)) errors.push('Invalid year');
      break;
      
    case 'jeePercentile':
    case 'mhtCetPercentile':
      if (value && !validatePercentile(value)) errors.push('Percentile must be between 0-100');
      break;
      
    case 'admissionType':
      if (!value) errors.push('Admission type is required');
      break;
      
      case 'branch':
        if (!value) errors.push('Branch is required');
        break;
        
      case 'division':
        if (!value) errors.push('Division is required');
        break;
        
      case 'yearOfStudy':
        if (!value) errors.push('Year of study is required');
        break;
        
      case 'gender':
      if (!value) errors.push('Gender is required');
      break;
      
    case 'category':
      if (!value) errors.push('Category is required');
      break;
      
    case 'photoUri':
      if (!value) errors.push('Profile photo is required');
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ==================== STEP VALIDATORS ====================

export const validateStep = (step: number, data: FormData): ValidationResult => {
  const errors: string[] = [];
  const fieldErrors: { [key: string]: string } = {};
  
  const addErrors = (field: string, result: ValidationResult) => {
    if (!result.isValid) {
      errors.push(...result.errors);
      fieldErrors[field] = result.errors[0];
    }
  };

  switch (step) {
    case 1: // Personal Info
      const step1Fields = ['fullName', 'gender', 'dob', 'branch', 'division', 'yearOfStudy', 'phone', 'email', 'category'];
      step1Fields.forEach(field => {
        const result = validateField(field, data[field as keyof FormData] as string, data);
        addErrors(field, result);
      });
      
      if (data.aadhar) {
        const result = validateField('aadhar', data.aadhar, data);
        addErrors('aadhar', result);
      }
      break;
      
    case 2: // Address & Family
      const step2Fields = ['permanentAddress', 'pincode', 'fatherName', 'fatherPhone', 'motherName', 'annualIncome'];
      step2Fields.forEach(field => {
        const result = validateField(field, data[field as keyof FormData] as string, data);
        addErrors(field, result);
      });
      
      if (data.motherPhone) {
        addErrors('motherPhone', validateField('motherPhone', data.motherPhone, data));
      }
      if (data.temporaryAddress) {
        addErrors('temporaryAddress', validateField('temporaryAddress', data.temporaryAddress, data));
      }
      break;
      
    case 3: // Education
      const sscFields = ['sscSchool', 'sscMarks', 'sscMaxMarks', 'sscYear'];
      sscFields.forEach(field => {
        addErrors(field, validateField(field, data[field as keyof FormData] as string, data));
      });
      
      const hscFieldsToCheck = ['hscCollege', 'hscMarks', 'hscMaxMarks', 'hscYear'];
      if (hscFieldsToCheck.some(field => data[field as keyof FormData])) {
        hscFieldsToCheck.forEach(field => {
          if (data[field as keyof FormData]) {
            addErrors(field, validateField(field, data[field as keyof FormData] as string, data));
          }
        });
        if ((data.hscMarks || data.hscMaxMarks) && !(data.hscMarks && data.hscMaxMarks)) {
          const msg = 'Both HSC marks and max marks are required';
          errors.push(msg);
          if (!data.hscMarks) fieldErrors.hscMarks = msg;
          if (!data.hscMaxMarks) fieldErrors.hscMaxMarks = msg;
        }
      }
      
      const dipFieldsToCheck = ['diplomaCollege', 'diplomaMarks', 'diplomaMaxMarks', 'diplomaYear'];
      if (dipFieldsToCheck.some(field => data[field as keyof FormData])) {
        dipFieldsToCheck.forEach(field => {
          if (data[field as keyof FormData]) {
            addErrors(field, validateField(field, data[field as keyof FormData] as string, data));
          }
        });
        if ((data.diplomaMarks || data.diplomaMaxMarks) && !(data.diplomaMarks && data.diplomaMaxMarks)) {
          const msg = 'Both Diploma marks and max marks are required';
          errors.push(msg);
          if (!data.diplomaMarks) fieldErrors.diplomaMarks = msg;
          if (!data.diplomaMaxMarks) fieldErrors.diplomaMaxMarks = msg;
        }
      }
      break;
      
    case 4: // Admission
      addErrors('admissionType', validateField('admissionType', data.admissionType, data));
      if (data.jeePercentile) addErrors('jeePercentile', validateField('jeePercentile', data.jeePercentile, data));
      if (data.mhtCetPercentile) addErrors('mhtCetPercentile', validateField('mhtCetPercentile', data.mhtCetPercentile, data));
      break;
      
    case 5: // Photo
      addErrors('photoUri', validateField('photoUri', data.photoUri, data));
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors
  };
};

// ==================== COMPLETE FORM VALIDATOR ====================

export const validateCompleteForm = (data: FormData): ValidationResult => {
  const allErrors: string[] = [];
  
  for (let step = 1; step <= 5; step++) {
    const result = validateStep(step, data);
    allErrors.push(...result.errors);
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
};

// ==================== HELPER: AUTO-CALCULATE PERCENTAGE ====================

export const calculatePercentage = (marks: string, maxMarks: string): string => {
  const marksNum = parseFloat(marks);
  const maxMarksNum = parseFloat(maxMarks);
  
  if (isNaN(marksNum) || isNaN(maxMarksNum) || maxMarksNum === 0) {
    return '';
  }
  
  const percentage = (marksNum / maxMarksNum) * 100;
  return percentage.toFixed(2);
};

// ==================== SANITIZATION HELPERS ====================

export const sanitizeInput = (value: string, type: 'text' | 'number' | 'email' | 'phone'): string => {
  switch (type) {
    case 'number':
    case 'phone':
      return value.replace(/[^\d]/g, '');
    case 'email':
      return value.trim().toLowerCase();
    case 'text':
    default:
      return value.trim();
  }
};

// ==================== EXPORT SIMPLIFIED FUNCTION ====================

export const getStepValidation = (step: number, data: any): boolean => {
  const result = validateStep(step, data as FormData);
  return result.isValid;
};
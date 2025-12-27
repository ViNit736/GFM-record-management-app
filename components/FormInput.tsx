import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TextInputProps,
  ViewStyle // Added for style support
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

// --- FormInput ---
interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  value: string;
  onChangeText?: (text: string) => void;
  containerStyle?: ViewStyle; // 👈 Added
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  value,
  onChangeText,
  editable = true,
  containerStyle, // 👈 Added
  ...props
}) => {
  const webId = Platform.OS === 'web'
    ? (props.nativeID ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    : undefined;

  return (
    <View style={[styles.inputContainer, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
        <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          editable === false && styles.inputDisabled
        ]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        accessibilityLabel={label}
        nativeID={webId}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// --- FormPicker ---
interface FormPickerProps {
  label: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: string[];
  error?: string;
  enabled?: boolean;
  containerStyle?: ViewStyle; // 👈 Added
}

export const FormPicker: React.FC<FormPickerProps> = ({
  label,
  selectedValue,
  onValueChange,
  items,
  error,
  enabled = true,
  containerStyle // 👈 Added
}) => {
  return (
    <View style={[styles.inputContainer, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.pickerContainer, error && styles.inputError]}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          style={styles.picker}
          enabled={enabled}
        >
          {items.map((item) => (
            <Picker.Item key={item} label={item} value={item} />
          ))}
        </Picker>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// --- FormDatePicker ---
interface FormDatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  error?: string;
  editable?: boolean;
  containerStyle?: ViewStyle; // 👈 Added
}

export const FormDatePicker: React.FC<FormDatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  editable = true,
  containerStyle // 👈 Added
}) => {
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Select Date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const webId = Platform.OS === 'web'
    ? (label.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    : undefined;

  return (
    <View style={[styles.inputContainer, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="YYYY-MM-DD"
        value={value}
        onChangeText={onChange}
        maxLength={10}
        keyboardType="default"
        editable={editable}
        accessibilityLabel={label}
        nativeID={webId}
      />
        {typeof value === 'string' && value && value.length >= 10 && (
          <Text style={styles.datePreview}>Preview: {formatDate(value)}</Text>
        )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333'
  },
  inputError: {
    borderColor: '#f44336',
    borderWidth: 2
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  picker: {
    height: Platform.OS === 'ios' ? 180 : 50
  },
  datePreview: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic'
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4
  }
});
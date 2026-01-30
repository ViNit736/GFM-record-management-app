import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { BRANCH_MAPPINGS, YEAR_MAPPINGS } from '../constants/Mappings';

interface RBTSuggestion {
    value: string;
    label: string;
}

interface RBTSuggestionInputProps {
    department?: string;
    year?: string;
    division?: string;
    value: string;
    onSelect: (value: string) => void;
    placeholder?: string;
}

/**
 * Smart RBT Suggestion Component
 * Generates RBT suggestions based on department, year, and division filters
 * 
 * Format Examples:
 * - RBT24CS (Computer Science, Second Year)
 * - RBT34ME (Mechanical Engineering, Third Year)
 * - RBTL2CS (Diploma Second Year Computer Science)
 */
export const RBTSuggestionInput: React.FC<RBTSuggestionInputProps> = ({
    department,
    year,
    division,
    value,
    onSelect,
    placeholder = 'Enter RBT number...'
}) => {
    const [suggestions, setSuggestions] = useState<RBTSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        generateSuggestions();
    }, [department, year, division, value]);

    const generateSuggestions = () => {
        if (!department || !year) {
            setSuggestions([]);
            return;
        }

        const suggestions: RBTSuggestion[] = [];
        const deptCode = department;

        // Determine if it's diploma or degree based on year
        const isDiploma = year === 'L1' || year === 'L2' || year === 'L3';

        if (isDiploma) {
            // Diploma format: RBTL{year}{dept}
            const yearNum = year.replace('L', '');
            const baseRBT = `RBTL${yearNum}${deptCode}`;

            if (division) {
                // With division: RBTL2CS-A
                suggestions.push({
                    value: `${baseRBT}-${division}`,
                    label: `${baseRBT}-${division} (${BRANCH_MAPPINGS[deptCode]} Diploma Year ${yearNum}, Div ${division})`
                });
            } else {
                // Without division, suggest all common divisions
                ['A', 'B', 'C'].forEach(div => {
                    suggestions.push({
                        value: `${baseRBT}-${div}`,
                        label: `${baseRBT}-${div} (${BRANCH_MAPPINGS[deptCode]} Diploma Year ${yearNum}, Div ${div})`
                    });
                });
            }
        } else {
            // Degree format: RBT{year}{dept}
            const yearNum = year.replace('Y', '');
            const baseRBT = `RBT${yearNum}${deptCode}`;

            if (division) {
                // With division: RBT24CS-A
                suggestions.push({
                    value: `${baseRBT}-${division}`,
                    label: `${baseRBT}-${division} (${BRANCH_MAPPINGS[deptCode]} ${YEAR_MAPPINGS[year]}, Div ${division})`
                });
            } else {
                // Without division, suggest all common divisions
                ['A', 'B', 'C'].forEach(div => {
                    suggestions.push({
                        value: `${baseRBT}-${div}`,
                        label: `${baseRBT}-${div} (${BRANCH_MAPPINGS[deptCode]} ${YEAR_MAPPINGS[year]}, Div ${div})`
                    });
                });
            }
        }

        // Filter suggestions based on current input
        const filtered = value
            ? suggestions.filter(s => s.value.toLowerCase().includes(value.toLowerCase()))
            : suggestions;

        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0 && value.length > 0);
    };

    const handleSelectSuggestion = (suggestion: RBTSuggestion) => {
        onSelect(suggestion.value);
        setShowSuggestions(false);
    };

    return (
        <View style={styles.container}>
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsHeader}>Suggested RBT Numbers:</Text>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleSelectSuggestion(item)}
                            >
                                <Text style={styles.suggestionValue}>{item.value}</Text>
                                <Text style={styles.suggestionLabel}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                        style={styles.suggestionsList}
                        nestedScrollEnabled
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 1000,
    },
    suggestionsContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginTop: 5,
        maxHeight: 250,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    suggestionsHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textLight,
        padding: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    suggestionsList: {
        maxHeight: 200,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    suggestionValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 4,
    },
    suggestionLabel: {
        fontSize: 12,
        color: COLORS.textLight,
    },
});

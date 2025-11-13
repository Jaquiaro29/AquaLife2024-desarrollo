import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/globalStyles';

const HeaderComponent = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.companyName}>AQUA LIFE</Text>
      <View style={styles.dateContainer}>
        <Text style={styles.country}>Venezuela</Text>
        <Text style={styles.date}>{dateTime.toLocaleDateString()}</Text>
        <Text style={styles.time}>{dateTime.toLocaleTimeString()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: 10,
    height: 60,
  },
  companyName: {
    color: colors.textInverse,
    fontWeight: 'bold',
    fontSize: 20,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  country: {
    color: colors.textInverse,
    fontWeight: 'bold',
    fontSize: 16,
  },
  date: {
    color: colors.textInverse,
    fontSize: 14,
  },
  time: {
    color: colors.textInverse,
    fontSize: 14,
  },
});

export default HeaderComponent;

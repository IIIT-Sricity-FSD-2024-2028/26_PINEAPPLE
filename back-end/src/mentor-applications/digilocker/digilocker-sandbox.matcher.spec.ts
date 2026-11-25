import { isDigiLockerNameMatch, normalizeDigiLockerTokens } from './digilocker-sandbox.provider';

describe('DigiLocker Sandbox Name Matcher unit tests', () => {
  it('matches exact normalised names', () => {
    expect(isDigiLockerNameMatch('John Doe', 'John Doe')).toBe(true);
    expect(isDigiLockerNameMatch('Aditya Sai', 'aditya sai')).toBe(true);
    expect(isDigiLockerNameMatch('Neha Gupta', '  neha   gupta  ')).toBe(true);
  });

  it('matches reordered tokens', () => {
    expect(isDigiLockerNameMatch('John Doe', 'Doe John')).toBe(true);
    expect(isDigiLockerNameMatch('Sharma Rahul Kumar', 'Kumar Rahul Sharma')).toBe(true);
  });

  it('matches when extra honorifics or punctuation are present', () => {
    expect(isDigiLockerNameMatch('Dr. John Doe', 'John Doe')).toBe(true);
    expect(isDigiLockerNameMatch('Prof. Dr. Jane Smith', 'Jane Smith')).toBe(true);
    expect(isDigiLockerNameMatch('Mr. Aditya Sai', 'Aditya Sai')).toBe(true);
    expect(isDigiLockerNameMatch('Shri Vikram Nair', 'Vikram Nair')).toBe(true);
  });

  it('rejects unrelated names that contain the target name as a substring', () => {
    // "Ali" in "Alice" or "Alicia"
    expect(isDigiLockerNameMatch('Ali', 'Alice')).toBe(false);
    expect(isDigiLockerNameMatch('Alice', 'Ali')).toBe(false);

    // "John" in "Johnathan"
    expect(isDigiLockerNameMatch('John', 'Johnathan')).toBe(false);

    // "Dan" in "Daniel"
    expect(isDigiLockerNameMatch('Dan', 'Daniel')).toBe(false);

    // "Roy" in "Royalty"
    expect(isDigiLockerNameMatch('Roy', 'Royalty')).toBe(false);

    // Partial names: "Kavita" vs "Kavita Verma"
    expect(isDigiLockerNameMatch('Kavita', 'Kavita Verma')).toBe(false);
    expect(isDigiLockerNameMatch('Kavita Verma', 'Kavita')).toBe(false);
  });

  it('rejects empty or whitespace inputs', () => {
    expect(isDigiLockerNameMatch('', 'John Doe')).toBe(false);
    expect(isDigiLockerNameMatch('John Doe', '')).toBe(false);
    expect(isDigiLockerNameMatch('   ', '   ')).toBe(false);
  });
});

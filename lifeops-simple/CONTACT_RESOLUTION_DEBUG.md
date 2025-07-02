# Contact Resolution Debug Log

**Problem**: LifeOps app shows phone numbers instead of contact names, even though contacts exist in macOS Contacts app.

**Test Case**: Matthew Sandoval with phone number `+1 (646) 256-6056` exists in Contacts but shows as `(646) 256-6056` in app.

## ✅ What We Know Works

1. **Contact exists**: Matthew Sandoval is confirmed to exist in Contacts app with phone `+1 (646) 256-6056`
2. **AppleScript can find by name**: 
   ```applescript
   tell application "Contacts"
     set matthewPeople to (every person whose name contains "Matthew Sandoval")
   end tell
   ```
   Returns: `Matthew Sandoval: +16462566056;` (found TWO entries)

3. **Phone normalization works**: Our `normalizePhoneNumber()` function correctly extracts `6462566056` from `+16462566056`

## ❌ Approaches That Failed

### 1. Original AppleScript Brute Force Search
**Issue**: Timeout with 15,817 contacts
```applescript
set peopleList to every person
repeat with aPerson in peopleList
  -- Search all contacts linearly
end repeat
```
**Limit**: 1000 contacts → Matthew not found (likely beyond contact #1000)

### 2. AppleScript Direct Phone Search
**Issue**: Built-in phone search doesn't work across all contact sources
```applescript
set peopleWithPhone to (people whose phone's value contains "6462566056")
```
**Result**: `NOT_FOUND` even though contact exists

### 3. AppleScript Formatted Phone Variations
**Issue**: Multiple format attempts all failed
```applescript
set formattedNumbers to {"646-256-6056", "(646) 256-6056", "+16462566056", "6462566056"}
repeat with phoneVariation in formattedNumbers
  set peopleWithPhone to (people whose phone's value contains phoneVariation)
end repeat
```
**Result**: `NOT_FOUND` for all variations

### 4. Swift CNContactStore - Basic Approach
**Issue**: Permission and property fetching errors
```swift
import Contacts
let store = CNContactStore()
store.requestAccess(for: .contacts) { granted, error in ... }
```
**Error**: 
```
CNPropertyNotFetchedException: A property was not requested when contact was fetched
```
**Root Cause**: Tried to use `CNContactFormatter` without fetching required keys

### 5. Increased AppleScript Search Limit
**Issue**: Still doesn't find Matthew even with 2000 contact limit
```applescript
if searchCount > 2000 then exit repeat
```
**Result**: Contact likely beyond first 2000 entries in 15,817 contact database

## 🔍 Root Cause Analysis

### Multi-Source Contact Database Issue
User has contacts from multiple sources:
- **iCloud** 
- **On My Mac**
- **OWA** (Outlook Web Access)
- **MojoID**
- **Total**: 15,817 contacts

**Hypothesis**: AppleScript's `every person` may not search all sources consistently, or Matthew's contact is in a source that's searched last.

### Performance vs. Accuracy Trade-off
- **Fast searches** (direct phone matching) → Don't work reliably
- **Comprehensive searches** (iterate all contacts) → Timeout before finding Matthew
- **Limited searches** (first N contacts) → Miss contacts beyond the limit

## 🚨 Key Insights

1. **Contact exists and is findable by name** - proves the data and permissions are correct
2. **Phone-based searches fail** - suggests AppleScript's phone field searching has limitations
3. **Contact is likely beyond first 2000 entries** - explains why limited searches fail
4. **Multiple contact sources complicate search** - AppleScript may not handle all sources uniformly

## 📋 Approaches NOT Yet Tried

### 1. AppleScript Name-First Hybrid Search
Search by common names first, then match phone numbers:
```applescript
-- Get contacts with common first names, then filter by phone
set commonNames to {"Matthew", "John", "Sarah", "Mike", "David"}
repeat with firstName in commonNames
  set people to (every person whose name contains firstName)
  -- Then check phones in this smaller subset
end repeat
```

### 2. Swift CNContactStore - Proper Implementation
Follow Apple's documentation exactly:
```swift
// Fetch ALL required keys for CNContactFormatter
let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactMiddleNameKey, 
            CNContactPhoneNumbersKey] as [CNKeyDescriptor]
```

### 3. macOS `contacts` CLI Alternative
Use system command if available:
```bash
# Check if system has built-in contacts command
contacts search "646-256-6056"
```

### 4. Batch Processing Approach
Process contacts in batches to avoid timeouts:
```applescript
-- Process contacts 500 at a time
repeat with batchStart from 1 to contactCount by 500
  set batch to items batchStart thru (batchStart + 499) of peopleList
end repeat
```

### 5. Source-Specific Search
Search each contact source individually:
```applescript
tell application "Contacts"
  repeat with aSource in every source
    set sourcePeople to every person in aSource
    -- Search within this specific source
  end repeat
end tell
```

## 🎯 Next Steps Priority

1. **Try name-first hybrid search** (highest chance of success)
2. **Implement proper Swift CNContactStore** (most robust long-term)
3. **Try batch processing AppleScript** (compromise approach)
4. **Investigate source-specific searching** (address root cause)

## 📊 Success Metrics

- **Immediate success**: Matthew Sandoval resolves to name instead of phone number
- **Broad success**: Significant increase in resolved contacts (currently 0 of 15 shown)
- **Performance success**: Contact resolution completes within 10 seconds
- **Reliability success**: Same contacts resolve consistently across app refreshes
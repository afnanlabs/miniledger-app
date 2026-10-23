import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from './AppText';
import { Card } from './Card';
import { colors, radius, spacing } from '../constants/theme';
import { authenticatedImageSource } from '../services/api';
import type { LoanReceipt, ReceiptSelection } from '../types';
import { formatFileSize } from '../utils/format';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.8,
  exif: false,
  selectionLimit: 1,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

function normalizeMime(mimeType: string | undefined | null, fileName: string | undefined | null): string | null {
  const mime = mimeType?.trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime && ALLOWED_MIME.has(mime)) return mime;

  const name = (fileName ?? '').toLowerCase();
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.webp$/.test(name)) return 'image/webp';

  // If the picker didn't give us a type, we still allow the selection and rely
  // on server-side magic-byte validation.
  if (!mime) return null;

  return null;
}

function showPermissionAlert(kind: 'Camera' | 'Photos', canAskAgain: boolean): void {
  const message =
    kind === 'Camera'
      ? 'MiniLedger needs camera access to take a receipt photo.'
      : 'MiniLedger needs photos access to attach a receipt from your library.';

  Alert.alert(
    `${kind} access needed`,
    message,
    canAskAgain
      ? [
          { text: 'Not now', style: 'cancel' },
          { text: 'Try again' },
        ]
      : [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
  );
}

interface ReceiptPickerProps {
  value: ReceiptSelection | null;
  onChange: (receipt: ReceiptSelection | null) => void;
  disabled?: boolean;
  error?: string;
}

export function ReceiptPicker({ value, onChange, disabled, error }: ReceiptPickerProps) {
  const [picking, setPicking] = useState(false);
  const [localError, setLocalError] = useState('');

  const displayError = error || localError;

  async function pickFromLibrary(): Promise<void> {
    if (disabled || picking) return;
    setLocalError('');
    setPicking(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showPermissionAlert('Photos', permission.canAskAgain);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mime = normalizeMime(asset.mimeType, asset.fileName ?? asset.uri);

      if (!mime) {
        setLocalError('Receipt must be a JPEG, PNG, or WebP image.');
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_RECEIPT_BYTES) {
        setLocalError('Receipt must be 5 MB or smaller.');
        return;
      }

      onChange({
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: mime,
        fileSize: asset.fileSize ?? null,
        file: asset.file,
      });
    } catch {
      setLocalError('Could not open the photo library. Please try again.');
    } finally {
      setPicking(false);
    }
  }

  async function takePhoto(): Promise<void> {
    if (disabled || picking) return;
    setLocalError('');
    setPicking(true);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showPermissionAlert('Camera', permission.canAskAgain);
        return;
      }

      const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mime = normalizeMime(asset.mimeType, asset.fileName ?? asset.uri);

      if (!mime) {
        setLocalError('Receipt must be a JPEG, PNG, or WebP image.');
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_RECEIPT_BYTES) {
        setLocalError('Receipt must be 5 MB or smaller.');
        return;
      }

      onChange({
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: mime,
        fileSize: asset.fileSize ?? null,
        file: asset.file,
      });
    } catch {
      setLocalError('Could not open the camera. Please try again.');
    } finally {
      setPicking(false);
    }
  }

  function removeReceipt(): void {
    if (disabled) return;
    setLocalError('');
    onChange(null);
  }

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="receipt-outline" size={18} color={colors.inkMuted} />
        </View>
        <View style={styles.headingText}>
          <AppText variant="smallStrong">Receipt</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Optional proof of the loan
          </AppText>
        </View>
      </View>

      {value ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: value.uri }} style={styles.previewImage} resizeMode="cover" />
          <View style={styles.previewMeta}>
            <AppText variant="smallStrong" numberOfLines={1}>
              {value.fileName || 'Receipt photo'}
            </AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {value.mimeType.replace('image/', '').toUpperCase()} ·{' '}
              {value.fileSize ? formatFileSize(value.fileSize) : 'Size unknown'}
            </AppText>
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => void pickFromLibrary()}
                disabled={disabled || picking}
                accessibilityRole="button"
                accessibilityLabel="Replace receipt photo"
                style={({ pressed }) => [
                  styles.textAction,
                  pressed && !disabled ? styles.textActionPressed : null,
                ]}
              >
                <AppText variant="smallStrong" color={colors.primary}>
                  Replace
                </AppText>
              </Pressable>
              <Pressable
                onPress={removeReceipt}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Remove receipt photo"
                style={({ pressed }) => [
                  styles.textAction,
                  pressed && !disabled ? styles.textActionPressed : null,
                ]}
              >
                <AppText variant="smallStrong" color={colors.danger}>
                  Remove
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pickerActions}>
          <Pressable
            onPress={() => void pickFromLibrary()}
            disabled={disabled || picking}
            accessibilityRole="button"
            accessibilityLabel="Choose receipt photo from library"
            style={({ pressed }) => [
              styles.actionButton,
              pressed && !disabled ? styles.actionButtonPressed : null,
              (disabled || picking) ? styles.actionButtonDisabled : null,
            ]}
          >
            <Ionicons name="images-outline" size={18} color={colors.ink} />
            <AppText variant="smallStrong">Choose photo</AppText>
          </Pressable>
          <Pressable
            onPress={() => void takePhoto()}
            disabled={disabled || picking}
            accessibilityRole="button"
            accessibilityLabel="Take receipt photo with camera"
            style={({ pressed }) => [
              styles.actionButton,
              pressed && !disabled ? styles.actionButtonPressed : null,
              (disabled || picking) ? styles.actionButtonDisabled : null,
            ]}
          >
            <Ionicons name="camera-outline" size={18} color={colors.ink} />
            <AppText variant="smallStrong">Take photo</AppText>
          </Pressable>
        </View>
      )}

      {displayError ? (
        <AppText variant="caption" color={colors.danger} style={styles.errorText}>
          {displayError}
        </AppText>
      ) : null}

      <AppText variant="caption" color={colors.inkFaint} style={styles.helperText}>
        JPEG, PNG, or WebP · up to 5 MB
      </AppText>
    </View>
  );
}

interface AttachedReceiptProps {
  receipt: LoanReceipt;
}

export function AttachedReceipt({ receipt }: AttachedReceiptProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  function open(): void {
    setLoading(true);
    setFailed(false);
    setVisible(true);
  }

  function close(): void {
    setVisible(false);
  }

  const source = authenticatedImageSource(receipt.url);
  const displayName = receipt.originalName || 'Receipt photo';

  return (
    <>
      <Card style={styles.attachedCard}>
        <View style={styles.attachedRow}>
          <View style={styles.attachedIcon}>
            <Ionicons name="document-attach-outline" size={18} color={colors.inkMuted} />
          </View>
          <View style={styles.attachedMeta}>
            <AppText variant="smallStrong" numberOfLines={1}>
              {displayName}
            </AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {receipt.mimeType.replace('image/', '').toUpperCase()} ·{' '}
              {formatFileSize(receipt.sizeBytes)}
            </AppText>
          </View>
          <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel="View receipt photo"
            style={({ pressed }) => [styles.viewButton, pressed ? styles.viewButtonPressed : null]}
          >
            <AppText variant="smallStrong" color={colors.primary}>
              View
            </AppText>
          </Pressable>
        </View>
      </Card>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
            <AppText variant="subheading" color={colors.surface}>
              Receipt
            </AppText>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close receipt"
              hitSlop={10}
              style={({ pressed }) => [
                styles.modalClose,
                pressed ? styles.modalClosePressed : null,
              ]}
            >
              <Ionicons name="close" size={22} color={colors.surface} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            {failed ? (
              <View style={styles.modalState}>
                <Ionicons name="alert-circle-outline" size={24} color={colors.surface} />
                <AppText variant="small" color={colors.surface} style={styles.modalStateText}>
                  Could not load the receipt. Check your connection and try again.
                </AppText>
              </View>
            ) : (
              <Image
                source={source}
                style={styles.modalImage}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            )}

            {loading && !failed ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={colors.surface} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headingIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  previewMeta: {
    flex: 1,
    gap: 2,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  textAction: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  textActionPressed: {
    opacity: 0.7,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    marginTop: spacing.sm,
  },
  helperText: {
    marginTop: spacing.sm,
  },
  attachedCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attachedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedMeta: {
    flex: 1,
  },
  viewButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  viewButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 26, 19, 0.92)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalClose: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClosePressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalLoading: {
    position: 'absolute',
  },
  modalState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  modalStateText: {
    textAlign: 'center',
  },
});

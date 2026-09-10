import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

type ReadingStatus = 'unread' | 'opened' | 'reading';
type Rank = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

interface BookCardProps {
  title: string;
  author?: string | undefined;
  format: string;
  addedAt?: number | undefined;
  lastOpenedAt?: number | undefined;
  readingStatus?: ReadingStatus | undefined;
  coverImage?: string | undefined;
  rank?: Rank | undefined;
  progressPercent?: number | undefined;
  onPress: () => void;
}

const COVER_PALETTES: [string, string][] = [
  ['#3a2e5c', '#6b4ea3'],
  ['#173a34', '#2f6d61'],
  ['#4a2b2b', '#8a3f3f'],
  ['#2c3a52', '#4a6a8a'],
  ['#453520', '#8a6a34'],
  ['#3a1f2e', '#7a3a55'],
  ['#1f3a3a', '#3a7a70'],
  ['#2e2540', '#5a4a8a'],
  ['#42301a', '#9a6a34'],
  ['#22303f', '#3f6a8a'],
];

const GLYPHS = ['Η', 'Θ', 'Β', 'Α', 'C', '∞', 'H', '⁂', 'Μ', '❦', 'G', 'B', 'Σ', 'Ω', 'Δ', 'Φ'];

function getCoverColors(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[idx] as [string, string];
}

function getGlyph(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % GLYPHS.length;
  return GLYPHS[idx] as string;
}

function getAuthorLast(author?: string): string {
  if (!author) return '';
  const parts = author.split(' ');
  return (parts[parts.length - 1] as string) ?? '';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function relativeDate(timestamp: number): string {
  const days = Math.round((Date.now() - timestamp) / 86400000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem.`;
  return formatDate(timestamp);
}

const STATUS_CONFIG: Record<ReadingStatus, { label: string; dotColor: string }> = {
  unread: { label: 'Sin leer', dotColor: '#c17b7b' },
  opened: { label: 'Abierto', dotColor: '#c9a24b' },
  reading: { label: 'Leyendo', dotColor: '#4fa393' },
};

function getStatus(status?: ReadingStatus, lastOpenedAt?: number): ReadingStatus {
  if (status) return status;
  if (lastOpenedAt) return 'opened';
  return 'unread';
}

export function BookCard({
  title,
  author,
  format,
  addedAt,
  lastOpenedAt,
  readingStatus,
  coverImage,
  rank,
  progressPercent,
  onPress,
}: BookCardProps): JSX.Element {
  const status = getStatus(readingStatus, lastOpenedAt);
  const statusCfg = STATUS_CONFIG[status];
  const [c1] = getCoverColors(title);
  const glyph = getGlyph(title);
  const authorLast = getAuthorLast(author);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.cover, { backgroundColor: c1 }]}>
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coverArt}>
            <Text style={styles.coverAuthor}>{authorLast}</Text>
            <Text style={styles.coverTitle} numberOfLines={3}>{title}</Text>
            <Text style={styles.coverGlyph}>{glyph}</Text>
          </View>
        )}
        <View style={styles.docTypeBadge}>
          <Text style={styles.docTypeText}>{format.toUpperCase()}</Text>
        </View>
        <View style={styles.statusTag}>
          <View style={[styles.dot, { backgroundColor: statusCfg.dotColor }]} />
          <Text style={styles.statusText}>{statusCfg.label}</Text>
        </View>
        {status === 'reading' && progressPercent !== undefined && progressPercent > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        {author && <Text style={styles.cardAuthor} numberOfLines={1}>{author}</Text>}
        <View style={styles.cardMeta}>
          {lastOpenedAt ? (
            <Text style={styles.metaText}>Visto {relativeDate(lastOpenedAt)}</Text>
          ) : addedAt ? (
            <Text style={styles.metaText}>Añadido {relativeDate(addedAt)}</Text>
          ) : null}
          {progressPercent !== undefined && progressPercent > 0 && (
            <Text style={[styles.metaText, { color: '#4fa393' }]}>{progressPercent}% leído</Text>
          )}
        </View>
        {rank !== undefined && rank > 0 && (
          <View style={styles.rankContainer}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Text
                key={s}
                style={[styles.rankStar, s <= rank ? styles.rankStarFilled : styles.rankStarEmpty]}
              >
                ★
              </Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    marginBottom: 16,
    gap: 11,
  },
  cover: {
    position: 'relative',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.85,
    shadowRadius: 30,
    elevation: 8,
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  docTypeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(16,15,24,.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
  },
  docTypeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: '#fff',
  },
  statusTag: {
    position: 'absolute',
    left: 10,
    top: 10,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingLeft: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(16,15,24,.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: '#efe9dd',
  },
  coverArt: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'space-between',
    padding: 16,
    paddingLeft: 18,
  },
  coverAuthor: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.72)',
    fontWeight: '600',
  },
  coverTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
    lineHeight: 20,
  },
  coverGlyph: {
    fontSize: 38,
    color: 'rgba(255,255,255,.24)',
    textAlign: 'right',
    lineHeight: 42,
  },
  cardBody: {
    gap: 3,
    paddingHorizontal: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#efe9dd',
    lineHeight: 20,
  },
  cardAuthor: {
    fontSize: 12,
    color: '#8b8598',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
  },
  metaText: {
    fontSize: 11,
    color: '#6a657a',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4fa393',
  },
  rankContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  rankStar: {
    fontSize: 12,
    marginRight: 1,
  },
  rankStarFilled: {
    color: '#c9a24b',
  },
  rankStarEmpty: {
    color: '#3a3548',
  },
});

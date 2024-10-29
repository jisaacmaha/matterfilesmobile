import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, TextInput, Alert, PanResponder, GestureResponderEvent, Animated, Image } from 'react-native';
import Svg, { Path, Text as SvgText, Line, Rect, Circle } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/app/styles/theme';
import { ThemedText } from './ThemedText';
import { captureRef } from 'react-native-view-shot';

// Interfaces
interface Point {
  x: number;
  y: number;
}

interface DrawPath {
  points: Point[];
  color: string;
}

interface TextAnnotation {
  id: string;
  text: string;
  position: Point;
  color: string;
}

interface IconAnnotation {
  id: string;
  type: 'tick' | 'cross';
  position: Point;
}

interface RectAnnotation {
  id: string;
  start: Point;
  end: Point;
  color: string;
}

interface MeasurementAnnotation {
  id: string;
  start: Point;
  end: Point;
  measurement: string;
}

interface Props {
  imageUri: string;
  visible: boolean;
  onClose: () => void;
  onSave: (annotations: AnnotationData) => Promise<void>;
  initialAnnotations?: AnnotationData;
}

interface AnnotationData {
  paths: DrawPath[];
  texts: TextAnnotation[];
  icons: IconAnnotation[];
  rectangles: RectAnnotation[];
  measurements: MeasurementAnnotation[];
  thumbnailUri: string;
}

interface SelectedAnnotation {
  type: 'path' | 'text' | 'icon' | 'rectangle' | 'measurement';
  id: string;
}

// For drawing and annotations, use a default color. Add this near the top:
const DEFAULT_COLOR = '#FF0000'; // or any color you prefer

// Add this helper function to calculate the perpendicular line points
const getPerpendicularPoints = (start: Point, end: Point, length: number = 20) => {
  // Calculate the angle of the main line
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  // Add 90 degrees (PI/2 radians) to get perpendicular angle
  const perpAngle = angle + Math.PI/2;
  
  // Calculate the points for the perpendicular line
  return {
    x1: start.x + length/2 * Math.cos(perpAngle),
    y1: start.y + length/2 * Math.sin(perpAngle),
    x2: start.x - length/2 * Math.cos(perpAngle),
    y2: start.y - length/2 * Math.sin(perpAngle),
  };
};

// Add this helper function to calculate text rotation and position
const getTextRotationAndPosition = (start: Point, end: Point) => {
  // Calculate angle in degrees
  let angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  
  // Adjust angle to keep text readable (not upside down)
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  // Calculate midpoint
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return { angle, midX, midY };
};

// Add to your types
type ComparisonMeasurement = {
  id: string;
  start: Point;
  end: Point;
  currentMeasurement: string;
  targetMeasurement: string;
};

interface SelectedItem {
  type: 'text' | 'icon' | 'rectangle' | 'measurement' | null
  id: string | null
  initialPosition: Point | null
}

// Add to the isComparisonTouched helper function
const isComparisonTouched = (point: Point, comparison: ComparisonMeasurement) => {
  const hitArea = 30; // Increased hit area
  return point.x >= Math.min(comparison.start.x, comparison.end.x) - hitArea &&
         point.x <= Math.max(comparison.start.x, comparison.end.x) + hitArea &&
         point.y >= Math.min(comparison.start.y, comparison.end.y) - hitArea &&
         point.y <= Math.max(comparison.start.y, comparison.end.y) + hitArea;
};

export function ImageAnnotator({ imageUri, visible, onClose, onSave, initialAnnotations }: Props) {
  // State
  const [mode, setMode] = useState<'draw' | 'text' | 'tick' | 'cross' | 'rectangle' | 'measure' | 'select' | 'delete' | 'compare'>('draw');
  const [paths, setPaths] = useState<DrawPath[]>(initialAnnotations?.paths || []);
  const [texts, setTexts] = useState<TextAnnotation[]>(initialAnnotations?.texts || []);
  const [icons, setIcons] = useState<IconAnnotation[]>(initialAnnotations?.icons || []);
  const [rectangles, setRectangles] = useState<RectAnnotation[]>(initialAnnotations?.rectangles || []);
  const [measurements, setMeasurements] = useState<MeasurementAnnotation[]>(initialAnnotations?.measurements || []);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [currentRect, setCurrentRect] = useState<RectAnnotation | null>(null);
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementAnnotation | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [measurementInput, setMeasurementInput] = useState('');
  const [showMeasurementInput, setShowMeasurementInput] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<SelectedAnnotation | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [undoStack, setUndoStack] = useState<AnnotationData[]>([]);
  const [showComparisonInput, setShowComparisonInput] = useState(false);
  const [currentComparisonInput, setCurrentComparisonInput] = useState('');
  const [targetComparisonInput, setTargetComparisonInput] = useState('');
  const [currentComparison, setCurrentComparison] = useState<ComparisonMeasurement | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonMeasurement[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({
    type: null,
    id: null,
    initialPosition: null
  });

  const imageAnnotatorRef = useRef<View>(null); 
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt, gestureState) => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = { x: locationX, y: locationY };

          if (mode === 'draw') {
            setCurrentPath({
              id: Date.now().toString(),
              points: [point],
              color: DEFAULT_COLOR,
            });
          } else if (mode === 'rectangle') {
            setCurrentRect({
              id: Date.now().toString(),
              start: point,
              end: point,
              color: DEFAULT_COLOR,
            });
          } else if (mode === 'measure') {
            setCurrentMeasurement({
              id: Date.now().toString(),
              start: point,
              end: point,
              measurement: '',
            });
          } else if (mode === 'compare') {
            setCurrentComparison({
              id: Date.now().toString(),
              start: point,
              end: point,
              currentMeasurement: '',
              targetMeasurement: '',
            });
          } else if (mode === 'text') {
            setTextPosition(point);
            setShowTextInput(true);
          } else if (mode === 'tick') {
            setIcons(prev => [...prev, {
              id: Date.now().toString(),
              type: 'tick',
              position: point
            }]);
            setHasUnsavedChanges(true);
          } else if (mode === 'cross') {
            setIcons(prev => [...prev, {
              id: Date.now().toString(),
              type: 'cross',
              position: point
            }]);
            setHasUnsavedChanges(true);
          } else if (mode === 'select') {
            handleSelection(evt);
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = { x: locationX, y: locationY };

          if (mode === 'select' && selectedItem.id && selectedItem.initialPosition) {
            const dx = locationX - selectedItem.initialPosition.x;
            const dy = locationY - selectedItem.initialPosition.y;

            switch (selectedItem.type) {
              case 'text':
                setTexts(prev => prev.map(text =>
                  text.id === selectedItem.id
                    ? { ...text, position: { x: text.position.x + dx, y: text.position.y + dy } }
                    : text
                ));
                break;
              case 'icon':
                setIcons(prev => prev.map(icon =>
                  icon.id === selectedItem.id
                    ? { ...icon, position: { x: icon.position.x + dx, y: icon.position.y + dy } }
                    : icon
                ));
                break;
              case 'rectangle':
                setRectangles(prev => prev.map(rect =>
                  rect.id === selectedItem.id
                    ? {
                        ...rect,
                        start: { x: rect.start.x + dx, y: rect.start.y + dy },
                        end: { x: rect.end.x + dx, y: rect.end.y + dy }
                      }
                    : rect
                ));
                break;
              case 'measurement':
                setMeasurements(prev => prev.map(measurement =>
                  measurement.id === selectedItem.id
                    ? {
                        ...measurement,
                        start: { x: measurement.start.x + dx, y: measurement.start.y + dy },
                        end: { x: measurement.end.x + dx, y: measurement.end.y + dy }
                      }
                    : measurement
                ));
                break;
              case 'comparison':
                setComparisons(prev => prev.map(comparison =>
                  comparison.id === selectedItem.id
                    ? {
                        ...comparison,
                        start: { x: comparison.start.x + dx, y: comparison.start.y + dy },
                        end: { x: comparison.end.x + dx, y: comparison.end.y + dy }
                      }
                    : comparison
                ));
                break;
            }
            
            // Update the initial position for the next move
            setSelectedItem(prev => ({
              ...prev,
              initialPosition: point
            }));
            setHasUnsavedChanges(true);
          } else if (mode === 'draw' && currentPath) {
            setCurrentPath({
              ...currentPath,
              points: [...currentPath.points, point],
            });
          } else if (mode === 'rectangle' && currentRect) {
            setCurrentRect({
              ...currentRect,
              end: point,
            });
          } else if (mode === 'measure' && currentMeasurement) {
            setCurrentMeasurement({
              ...currentMeasurement,
              end: point,
            });
          } else if (mode === 'compare' && currentComparison) {
            setCurrentComparison({
              ...currentComparison,
              end: point,
            });
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          if (mode === 'draw' && currentPath) {
            setPaths([...paths, currentPath]);
            setCurrentPath(null);
            setHasUnsavedChanges(true);
          } else if (mode === 'rectangle' && currentRect) {
            setRectangles([...rectangles, currentRect]);
            setCurrentRect(null);
            setHasUnsavedChanges(true);
          } else if (mode === 'measure' && currentMeasurement) {
            setShowMeasurementInput(true);
            setHasUnsavedChanges(true);
          } else if (mode === 'compare' && currentComparison) {
            setShowComparisonInput(true);
            setHasUnsavedChanges(true);
          } else if (mode === 'select') {
            setSelectedItem({ type: null, id: null, initialPosition: null });
          }
        },
      }),
    [mode, currentPath, currentRect, currentMeasurement, currentComparison, paths, rectangles, selectedItem, texts, icons, measurements]
  );

  // Touch handlers
  const handleTouchStart = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const point = { x: locationX, y: locationY };

    if (mode === 'delete') {
      handleDeletion(point);
    } else if (mode === 'select') {
      handleSelection(event);
    } else if (mode === 'draw') {
      setCurrentPath({ points: [point], color: DEFAULT_COLOR });
    } else if (mode === 'text') {
      setTextPosition(point);
      setShowTextInput(true);
    } else if (mode === 'tick' || mode === 'cross') {
      saveToUndoStack();
      const newIcon: IconAnnotation = {
        id: Date.now().toString(),
        type: mode,
        position: point,
      };
      setIcons(prev => [...prev, newIcon]);
      setHasUnsavedChanges(true);
    } else if (mode === 'rectangle') {
      setCurrentRect({
        id: Date.now().toString(),
        start: point,
        end: point,
        color: DEFAULT_COLOR,
      });
    } else if (mode === 'measure') {
      setCurrentMeasurement({
        id: Date.now().toString(),
        start: point,
        end: point,
        measurement: '',
      });
    }
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const point = { x: locationX, y: locationY };

    if (mode === 'draw' && currentPath) {
      setCurrentPath({
        ...currentPath,
        points: [...currentPath.points, point],
      });
    } else if (mode === 'rectangle' && currentRect) {
      setCurrentRect({
        ...currentRect,
        end: point,
      });
    } else if (mode === 'measure' && currentMeasurement) {
      setCurrentMeasurement({
        ...currentMeasurement,
        end: point,
      });
    }
  };

  const handleTouchEnd = () => {
    if (mode === 'draw' && currentPath) {
      setPaths([...paths, currentPath]);
      setCurrentPath(null);
      setHasUnsavedChanges(true);
    } else if (mode === 'rectangle' && currentRect) {
      setRectangles([...rectangles, currentRect]);
      setCurrentRect(null);
      setHasUnsavedChanges(true);
    } else if (mode === 'measure' && currentMeasurement) {
      setShowMeasurementInput(true);
      setHasUnsavedChanges(true);
    }
  };

  const handleSelection = (event: GestureResponderEvent) => {
    if (mode !== 'select') return;
    
    const { locationX, locationY } = event.nativeEvent;
    const point = { x: locationX, y: locationY };

    // Check texts
    const touchedText = texts.find(t => isTextTouched(point, t));
    if (touchedText) {
      setSelectedItem({
        type: 'text',
        id: touchedText.id,
        initialPosition: { ...point }
      });
      return;
    }

    // Check icons
    const touchedIcon = icons.find(i => isIconTouched(point, i));
    if (touchedIcon) {
      setSelectedItem({
        type: 'icon',
        id: touchedIcon.id,
        initialPosition: { ...point }
      });
      return;
    }

    // Check rectangles
    const touchedRect = rectangles.find(r => isRectangleTouched(point, r));
    if (touchedRect) {
      setSelectedItem({
        type: 'rectangle',
        id: touchedRect.id,
        initialPosition: { ...point }
      });
      return;
    }

    // Check measurements
    const touchedMeasurement = measurements.find(m => isMeasurementTouched(point, m));
    if (touchedMeasurement) {
      setSelectedItem({
        type: 'measurement',
        id: touchedMeasurement.id,
        initialPosition: { ...point }
      });
      return;
    }

    // Add check for comparisons
    const touchedComparison = comparisons.find(c => isComparisonTouched(point, c));
    if (touchedComparison) {
      setSelectedItem({
        type: 'comparison',
        id: touchedComparison.id,
        initialPosition: { ...point }
      });
      return;
    }

    setSelectedItem({ type: null, id: null, initialPosition: null });
  };

  const handleMove = (gestureState: any) => {
    if (!selectedAnnotation) return;

    const { dx, dy } = gestureState;

    switch (selectedAnnotation.type) {
      case 'text':
        setTexts(prev => prev.map(t => 
          t.id === selectedAnnotation.id 
            ? { ...t, position: { x: t.position.x + dx, y: t.position.y + dy } }
            : t
        ));
        break;
      case 'icon':
        setIcons(prev => prev.map(i => 
          i.id === selectedAnnotation.id 
            ? { ...i, position: { x: i.position.x + dx, y: i.position.y + dy } }
            : i
        ));
        break;
      case 'rectangle':
        setRectangles(prev => prev.map(r => 
          r.id === selectedAnnotation.id 
            ? { 
                ...r, 
                start: { x: r.start.x + dx, y: r.start.y + dy },
                end: { x: r.end.x + dx, y: r.end.y + dy }
              }
            : r
        ));
        break;
      case 'measurement':
        setMeasurements(prev => prev.map(m => 
          m.id === selectedAnnotation.id 
            ? { 
                ...m, 
                start: { x: m.start.x + dx, y: m.start.y + dy },
                end: { x: m.end.x + dx, y: m.end.y + dy }
              }
            : m
        ));
        break;
    }
    setHasUnsavedChanges(true);
  };

  // Helper functions for hit testing
  const isTextTouched = (point: Point, text: TextAnnotation) => {
    const hitArea = 50; // Increased hit area
    return Math.abs(point.x - text.position.x) < hitArea && 
           Math.abs(point.y - text.position.y) < hitArea;
  };

  const isIconTouched = (point: Point, icon: IconAnnotation) => {
    const hitArea = 30; // Increased hit area
    return Math.abs(point.x - icon.position.x) < hitArea && 
           Math.abs(point.y - icon.position.y) < hitArea;
  };

  const isRectangleTouched = (point: Point, rect: RectAnnotation) => {
    const hitArea = 30; // Increased hit area
    return point.x >= Math.min(rect.start.x, rect.end.x) - hitArea &&
           point.x <= Math.max(rect.start.x, rect.end.x) + hitArea &&
           point.y >= Math.min(rect.start.y, rect.end.y) - hitArea &&
           point.y <= Math.max(rect.start.y, rect.end.y) + hitArea;
  };

  const isMeasurementTouched = (point: Point, measurement: MeasurementAnnotation) => {
    const hitArea = 30; // Increased hit area
    return point.x >= Math.min(measurement.start.x, measurement.end.x) - hitArea &&
           point.x <= Math.max(measurement.start.x, measurement.end.x) + hitArea &&
           point.y >= Math.min(measurement.start.y, measurement.end.y) - hitArea &&
           point.y <= Math.max(measurement.start.y, measurement.end.y) + hitArea;
  };

  // Save handler
  const handleSave = async () => {
    try {
      const thumbnailUri = await captureRef(imageAnnotatorRef, { 
        format: 'png',
        quality: 1,
      });
      // console.log('Thumbnail URI:', thumbnailUri);
      const annotationData: AnnotationData = {
        paths,
        texts,
        icons,
        rectangles,
        measurements,
        thumbnailUri,
      };
      await onSave(annotationData);
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save annotations');
    }
  };

  // Undo handler
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setPaths(previousState.paths);
      setTexts(previousState.texts);
      setIcons(previousState.icons);
      setRectangles(previousState.rectangles);
      setMeasurements(previousState.measurements);
      setUndoStack(prev => prev.slice(0, -1));
    }
  };

  // Add this function near the other utility functions
  const saveToUndoStack = () => {
    setUndoStack(prev => [...prev, {
      paths,
      texts,
      icons,
      rectangles,
      measurements,
    }]);
  };

  // Add handleDeletion function
  const handleDeletion = (point: Point) => {
    // console.log('Attempting deletion at point:', point);
    
    // Save current state to undo stack before deletion
    saveToUndoStack();
    let deletedSomething = false;

    // Check and delete texts
    setTexts(prev => {
      const newTexts = prev.filter(t => !isTextTouched(point, t));
      if (newTexts.length !== prev.length) {
        console.log('Deleted text annotation');
        deletedSomething = true;
      }
      return newTexts;
    });
    
    // Check and delete icons
    setIcons(prev => {
      const newIcons = prev.filter(i => !isIconTouched(point, i));
      if (newIcons.length !== prev.length) {
        console.log('Deleted icon annotation');
        deletedSomething = true;
      }
      return newIcons;
    });
    
    // Check and delete rectangles
    setRectangles(prev => {
      const newRects = prev.filter(r => !isRectangleTouched(point, r));
      if (newRects.length !== prev.length) {
        console.log('Deleted rectangle annotation');
        deletedSomething = true;
      }
      return newRects;
    });
    
    // Check and delete measurements
    setMeasurements(prev => {
      const newMeasurements = prev.filter(m => !isMeasurementTouched(point, m));
      if (newMeasurements.length !== prev.length) {
        console.log('Deleted measurement annotation');
        deletedSomething = true;
      }
      return newMeasurements;
    });

    if (deletedSomething) {
      console.log('Changes saved to undo stack');
      setHasUnsavedChanges(true);
    } else {
      console.log('No annotations found at this point');
    }
  };

  // Add this function to handle clearing all annotations
  const handleClearAll = () => {
    // Save current state to undo stack before clearing
    saveToUndoStack();
    
    // Clear all annotations
    setPaths([]);
    setTexts([]);
    setIcons([]);
    setRectangles([]);
    setMeasurements([]);
    
    // Set unsaved changes flag
    setHasUnsavedChanges(true);
  };

  // Render method
  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={onClose}
          >
            <ThemedText style={styles.headerButtonText}>Cancel</ThemedText>
          </TouchableOpacity>

          <View style={styles.headerControls}>
            <TouchableOpacity
              style={[styles.headerTool, mode === 'select' && styles.activeTool]}
              onPress={() => setMode('select')}
            >
              <Ionicons name="move" size={24} color={mode === 'select' ? theme.colors.primary : theme.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerTool}
              onPress={handleUndo}
              disabled={undoStack.length === 0}
            >
              <Ionicons 
                name="arrow-undo" 
                size={24} 
                color={undoStack.length === 0 ? theme.colors.textSecondary : theme.colors.text} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerTool}
              onPress={() => {
                Alert.alert(
                  'Clear All',
                  'Are you sure you want to clear all annotations?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Clear All',
                      onPress: handleClearAll,
                      style: 'destructive',
                    },
                  ]
                );
              }}
            >
              <Ionicons 
                name="trash" 
                size={24} 
                color={theme.colors.error}
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.headerButton, 
              !hasUnsavedChanges && styles.headerButtonDisabled
            ]} 
            onPress={handleSave}
            disabled={!hasUnsavedChanges}
          >
            <ThemedText 
              style={[
                styles.headerButtonText,
                styles.saveButton,
                !hasUnsavedChanges && styles.headerButtonTextDisabled
              ]}
            >
              Save
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Canvas */}
        <View 
          ref={imageAnnotatorRef}
          style={styles.canvas}
          {...panResponder.panHandlers}
        >
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          <Svg style={StyleSheet.absoluteFill}>
            {/* Draw paths */}
            {paths.map((path, index) => (
              <Path
                key={index}
                d={`M ${path.points.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                stroke={path.color}
                strokeWidth={2}
                fill="none"
              />
            ))}
            {currentPath && (
              <Path
                d={`M ${currentPath.points.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                stroke={currentPath.color}
                strokeWidth={2}
                fill="none"
              />
            )}

            {/* Text annotations - remove selection stroke */}
            {texts.map((text, index) => (
              <React.Fragment key={index}>
                <Rect
                  x={text.position.x - (text.text.length * 4.5)}
                  y={text.position.y - 15}
                  width={text.text.length * 9}
                  height={30}
                  fill="#F5F5F5"
                  rx={15}
                  ry={15}
                />
                <SvgText
                  x={text.position.x}
                  y={text.position.y + 5}
                  fill="#000000"
                  fontSize="16"
                  textAnchor="middle"
                >
                  {text.text}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Icons - remove selection circle */}
            {icons.map((icon, index) => (
              <React.Fragment key={index}>
                <SvgText
                  x={icon.position.x}
                  y={icon.position.y}
                  fill={icon.type === 'tick' ? '#22C55E' : '#EF4444'}
                  fontSize="40"
                  textAnchor="middle"
                >
                  {icon.type === 'tick' ? '✓' : '✕'}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Rectangles - no changes needed as they don't have selection indicators */}
            {rectangles.map((rect, index) => (
              <Rect
                key={index}
                x={Math.min(rect.start.x, rect.end.x)}
                y={Math.min(rect.start.y, rect.end.y)}
                width={Math.abs(rect.end.x - rect.start.x)}
                height={Math.abs(rect.end.y - rect.start.y)}
                stroke={rect.color}
                strokeWidth={2}
                fill="none"
              />
            ))}
            {currentRect && (
              <Rect
                x={Math.min(currentRect.start.x, currentRect.end.x)}
                y={Math.min(currentRect.start.y, currentRect.end.y)}
                width={Math.abs(currentRect.end.x - currentRect.start.x)}
                height={Math.abs(currentRect.end.y - currentRect.start.y)}
                stroke={currentRect.color}
                strokeWidth={2}
                fill="none"
              />
            )}

            {/* Measurements with manual arrows */}
            {/* Current measurement being drawn */}
            {currentMeasurement && (
              <>
                {/* Main line */}
                <Line
                  x1={currentMeasurement.start.x}
                  y1={currentMeasurement.start.y}
                  x2={currentMeasurement.end.x}
                  y2={currentMeasurement.end.y}
                  stroke={DEFAULT_COLOR}
                  strokeWidth={2}
                />
                {/* Start perpendicular line */}
                {(() => {
                  const startPerp = getPerpendicularPoints(currentMeasurement.start, currentMeasurement.end);
                  return (
                    <Line
                      x1={startPerp.x1}
                      y1={startPerp.y1}
                      x2={startPerp.x2}
                      y2={startPerp.y2}
                      stroke={DEFAULT_COLOR}
                      strokeWidth={2}
                    />
                  );
                })()}
                {/* End perpendicular line */}
                {(() => {
                  const endPerp = getPerpendicularPoints(currentMeasurement.end, currentMeasurement.start);
                  return (
                    <Line
                      x1={endPerp.x1}
                      y1={endPerp.y1}
                      x2={endPerp.x2}
                      y2={endPerp.y2}
                      stroke={DEFAULT_COLOR}
                      strokeWidth={2}
                    />
                  );
                })()}
                {/* Rotated text with background */}
                {(() => {
                  const { angle, midX, midY } = getTextRotationAndPosition(currentMeasurement.start, currentMeasurement.end);
                  return (
                    <>
                      <Rect
                        x={midX - 25}
                        y={midY - 10}
                        width={50}
                        height={20}
                        fill="#F5F5F5"
                        rx={10}
                        ry={10}
                        transform={`rotate(${angle} ${midX} ${midY})`}
                      />
                      <SvgText
                        x={midX}
                        y={midY + 4}
                        fill="#000000"
                        fontSize="12"
                        textAnchor="middle"
                        transform={`rotate(${angle} ${midX} ${midY})`}
                      >
                        {currentMeasurement.measurement}
                      </SvgText>
                    </>
                  );
                })()}
              </>
            )}

            {/* Existing measurements */}
            {measurements.map((measurement, index) => (
              <React.Fragment key={index}>
                {/* Main line */}
                <Line
                  x1={measurement.start.x}
                  y1={measurement.start.y}
                  x2={measurement.end.x}
                  y2={measurement.end.y}
                  stroke={DEFAULT_COLOR}
                  strokeWidth={2}
                />
                {/* Perpendicular lines */}
                {(() => {
                  const startPerp = getPerpendicularPoints(measurement.start, measurement.end);
                  const endPerp = getPerpendicularPoints(measurement.end, measurement.start);
                  return (
                    <>
                      <Line
                        x1={startPerp.x1}
                        y1={startPerp.y1}
                        x2={startPerp.x2}
                        y2={startPerp.y2}
                        stroke={DEFAULT_COLOR}
                        strokeWidth={2}
                      />
                      <Line
                        x1={endPerp.x1}
                        y1={endPerp.y1}
                        x2={endPerp.x2}
                        y2={endPerp.y2}
                        stroke={DEFAULT_COLOR}
                        strokeWidth={2}
                      />
                    </>
                  );
                })()}
                {/* Rotated text with background */}
                {(() => {
                  const { angle, midX, midY } = getTextRotationAndPosition(measurement.start, measurement.end);
                  return (
                    <>
                      {/* Chip background */}
                      <Rect
                        x={midX - 25}
                        y={midY - 10}
                        width={50}
                        height={20}
                        fill="#F5F5F5"
                        rx={10}  // More rounded corners (half of height)
                        ry={10}  // More rounded corners (half of height)
                        transform={`rotate(${angle} ${midX} ${midY})`}
                      />
                      <SvgText
                        x={midX}
                        y={midY + 4}  // Slightly adjusted for better centering
                        fill="#000000"
                        fontSize="12"  // Slightly smaller text
                        textAnchor="middle"
                        transform={`rotate(${angle} ${midX} ${midY})`}
                      >
                        {measurement.measurement}
                      </SvgText>
                    </>
                  );
                })()}
              </React.Fragment>
            ))}

            {/* Comparison Measurements */}
            {comparisons.map((comparison, index) => (
              <React.Fragment key={index}>
                {/* Main line */}
                <Line
                  x1={comparison.start.x}
                  y1={comparison.start.y}
                  x2={comparison.end.x}
                  y2={comparison.end.y}
                  stroke={DEFAULT_COLOR}
                  strokeWidth={2}
                />
                {/* Perpendicular lines */}
                {(() => {
                  const startPerp = getPerpendicularPoints(comparison.start, comparison.end);
                  const endPerp = getPerpendicularPoints(comparison.end, comparison.start);
                  return (
                    <>
                      <Line
                        x1={startPerp.x1}
                        y1={startPerp.y1}
                        x2={startPerp.x2}
                        y2={startPerp.y2}
                        stroke={DEFAULT_COLOR}
                        strokeWidth={2}
                      />
                      <Line
                        x1={endPerp.x1}
                        y1={endPerp.y1}
                        x2={endPerp.x2}
                        y2={endPerp.y2}
                        stroke={DEFAULT_COLOR}
                        strokeWidth={2}
                      />
                    </>
                  );
                })()}
                {/* Rotated text with background */}
                {(() => {
                  const { angle, midX, midY } = getTextRotationAndPosition(comparison.start, comparison.end);
                  return (
                    <>
                      <Rect
                        x={midX - 40}
                        y={midY - 10}
                        width={80}
                        height={20}
                        fill="#F5F5F5"
                        rx={10}
                        ry={10}
                        transform={`rotate(${angle} ${midX} ${midY})`}
                      />
                      <SvgText
                        x={midX}
                        y={midY + 4}
                        fill="#000000"
                        fontSize="12"
                        textAnchor="middle"
                        transform={`rotate(${angle} ${midX} ${midY})`}
                      >
                        {`${comparison.currentMeasurement}→${comparison.targetMeasurement}`}
                      </SvgText>
                    </>
                  );
                })()}
              </React.Fragment>
            ))}

            {/* Current comparison being drawn */}
            {currentComparison && (
              <>
                <Line
                  x1={currentComparison.start.x}
                  y1={currentComparison.start.y}
                  x2={currentComparison.end.x}
                  y2={currentComparison.end.y}
                  stroke={DEFAULT_COLOR}
                  strokeWidth={2}
                />
                {(() => {
                  const startPerp = getPerpendicularPoints(currentComparison.start, currentComparison.end);
                  const endPerp = getPerpendicularPoints(currentComparison.end, currentComparison.start);
                  return (
                    <>
                      <Line
                        x1={startPerp.x1}
                        y1={startPerp.y1}
                        x2={startPerp.x2}
                        y2={startPerp.y2}
                        stroke={DEFAULT_COLOR}
                        strokeWidth={2}
                      />
                      <Line
                        x1={endPerp.x1}
                        y1={endPerp.y1}
                        x2={endPerp.x2}
                        y2={endPerp.y2}
                        stroke={DEFAULT_COLOR}
                        strokeWidth={2}
                      />
                    </>
                  );
                })()}
              </>
            )}
          </Svg>

          {/* Text Input Modal */}
          {showTextInput && (
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={textInput}
                onChangeText={setTextInput}
                placeholder="Enter text..."
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
              />
              <View style={styles.inputButtons}>
                <TouchableOpacity 
                  style={[styles.inputButton, styles.cancelButton]}
                  onPress={() => {
                    setShowTextInput(false);
                    setTextInput('');
                  }}
                >
                  <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.inputButton, styles.addButton]}
                  onPress={() => {
                    if (textInput && textPosition) {
                      setTexts([...texts, {
                        id: Date.now().toString(),
                        text: textInput,
                        position: textPosition,
                        color: theme.colors.text,
                      }]);
                      setTextInput('');
                      setShowTextInput(false);
                      setHasUnsavedChanges(true);
                    }
                  }}
                >
                  <ThemedText>Add</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Measurement Input Modal */}
          {showMeasurementInput && (
            <View style={styles.measurementInputContainer}>
              <TextInput
                style={styles.textInput}
                value={measurementInput}
                onChangeText={setMeasurementInput}
                placeholder="Enter measurement..."
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
                autoFocus
              />
              <View style={styles.inputButtons}>
                <TouchableOpacity 
                  style={[styles.inputButton, styles.cancelButton]}
                  onPress={() => {
                    setShowMeasurementInput(false);
                    setMeasurementInput('');
                    setCurrentMeasurement(null);
                  }}
                >
                  <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.inputButton, styles.addButton]}
                  onPress={() => {
                    if (measurementInput && currentMeasurement) {
                      setMeasurements([...measurements, {
                        ...currentMeasurement,
                        measurement: measurementInput,
                      }]);
                      setMeasurementInput('');
                      setShowMeasurementInput(false);
                      setCurrentMeasurement(null);
                      setHasUnsavedChanges(true);
                    }
                  }}
                >
                  <ThemedText>Add</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Comparison Input Modal */}
          {showComparisonInput && (
            <View style={styles.measurementInputContainer}>
              <View style={styles.comparisonInputs}>
                <TextInput
                  style={[styles.textInput, styles.comparisonInput]}
                  value={currentComparisonInput}
                  onChangeText={setCurrentComparisonInput}
                  placeholder="Current measurement..."
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.comparisonArrowContainer}>
                  <ThemedText style={styles.comparisonArrow}>→</ThemedText>
                </View>
                <TextInput
                  style={[styles.textInput, styles.comparisonInput]}
                  value={targetComparisonInput}
                  onChangeText={setTargetComparisonInput}
                  placeholder="Target measurement..."
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputButtons}>
                <TouchableOpacity 
                  style={[styles.inputButton, styles.cancelButton]}
                  onPress={() => {
                    setShowComparisonInput(false);
                    setCurrentComparisonInput('');
                    setTargetComparisonInput('');
                    setCurrentComparison(null);
                  }}
                >
                  <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.inputButton, styles.addButton]}
                  onPress={() => {
                    if (currentComparisonInput && targetComparisonInput && currentComparison) {
                      setComparisons([...comparisons, {
                        ...currentComparison,
                        currentMeasurement: currentComparisonInput,
                        targetMeasurement: targetComparisonInput,
                      }]);
                      setCurrentComparisonInput('');
                      setTargetComparisonInput('');
                      setShowComparisonInput(false);
                      setCurrentComparison(null);
                      setHasUnsavedChanges(true);
                    }
                  }}
                >
                  <ThemedText>Add</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Add back the bottom toolbar with drawing tools */}
        <View style={styles.toolbar}>
          <View style={styles.toolRow}>
            <TouchableOpacity
              style={[styles.tool, mode === 'draw' && styles.activeTool]}
              onPress={() => setMode('draw')}
            >
              <Ionicons name="pencil" size={24} color={mode === 'draw' ? theme.colors.primary : theme.colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, mode === 'text' && styles.activeTool]}
              onPress={() => setMode('text')}
            >
              <Ionicons 
                name="chatbubble-outline" 
                size={24} 
                color={mode === 'text' ? theme.colors.primary : theme.colors.text} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, mode === 'tick' && styles.activeTool]}
              onPress={() => setMode('tick')}
            >
              <Ionicons name="checkmark" size={24} color={mode === 'tick' ? theme.colors.primary : theme.colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, mode === 'cross' && styles.activeTool]}
              onPress={() => setMode('cross')}
            >
              <Ionicons name="close" size={24} color={mode === 'cross' ? theme.colors.primary : theme.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tool, mode === 'rectangle' && styles.activeTool]}
              onPress={() => setMode('rectangle')}
            >
              <Ionicons name="square-outline" size={24} color={mode === 'rectangle' ? theme.colors.primary : theme.colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, mode === 'measure' && styles.activeTool]}
              onPress={() => setMode('measure')}
            >
              <MaterialCommunityIcons 
                name="ruler" 
                size={24} 
                color={mode === 'measure' ? theme.colors.primary : theme.colors.text} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tool, mode === 'compare' && styles.activeTool]}
              onPress={() => setMode('compare')}
            >
              <MaterialCommunityIcons 
                name="ruler-square" 
                size={24} 
                color={mode === 'compare' ? theme.colors.primary : theme.colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  headerControls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  headerTool: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  activeTool: {
    backgroundColor: theme.colors.surfaceHighlight,
  },
  headerButton: {
    padding: theme.spacing.md,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primary, // Make all buttons blue
  },
  saveButton: {
    color: theme.colors.primary, // Blue color for save button
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonTextDisabled: {
    opacity: 0.5,
  },
  canvas: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  toolbar: {
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl, // Add extra padding at the bottom
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  tool: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputContainer: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    zIndex: 3,
  },
  measurementInputContainer: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    zIndex: 3,
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    height: 40,
  },
  inputButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.xs,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
  },
  comparisonInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  comparisonInput: {
    flex: 1,
  },
  comparisonArrowContainer: {
    paddingHorizontal: theme.spacing.sm,
  },
  comparisonArrow: {
    fontSize: 20,
    color: theme.colors.text,
  },
});

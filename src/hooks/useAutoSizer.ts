import React, { useCallback, useState, useRef, useEffect } from "react";
import { ViewPortProps, GridRef, CellInterface, ItemSizer } from "./../Grid";
import { debounce } from "./../helpers";
import invariant from "tiny-invariant";

interface IProps {
  gridRef: React.MutableRefObject<GridRef>;
  getValue: (cell: CellInterface) => any;
  initialVisibleRows?: number;
  minColumnWidth?: number;
  cellSpacing?: number;
  timeout?: number;
  resizeOnScroll?: boolean;
  font?: string;
  resizeStrategy?: ResizeStrategy;
  rowCount?: number;
}

enum ResizeStrategy {
  "lazy" = "lazy",
  "full" = "full",
}

interface AutoResizerResults {
  columnWidth: ItemSizer;
  onViewChange: (cells: ViewPortProps) => void;
}

/**
 * Auto sizer hook
 * @param param
 *
 * TODO
 * Dynamically resize columns after user has scrolled down/view port changed ?
 */
const useAutoSizer = ({
  gridRef,
  getValue,
  initialVisibleRows = 20,
  cellSpacing = 10,
  minColumnWidth = 60,
  timeout = 300,
  resizeStrategy = ResizeStrategy.lazy,
  rowCount,
  resizeOnScroll = true,
  font = "12px Arial",
}: IProps): AutoResizerResults => {
  invariant(
    !(resizeStrategy === ResizeStrategy.full && rowCount === void 0),
    "Row count should be specified if resize stragtegy is full"
  );

  const autoSizer = useRef(AutoSizerCanvas(font));
  const [viewport, setViewport] = useState<ViewPortProps>({
    rowStartIndex: 0,
    rowStopIndex: 0,
    columnStartIndex: 0,
    columnStopIndex: 0,
  });
  const isMounted = useRef(false);
  const debounceResizer = useRef(
    debounce(
      ({ rowIndex, columnIndex }: CellInterface) =>
        gridRef.current.resetAfterIndices({ rowIndex, columnIndex }),
      timeout
    )
  );

  useEffect(() => {
    isMounted.current = true;
  }, []);

  /* Update any styles, fonts if necessary */
  useEffect(() => {
    autoSizer.current.setFont(font);
  }, [font]);

  const getColumnWidth = useCallback(
    (columnIndex: number) => {
      const { rowStartIndex, rowStopIndex } = viewport;
      const visibleRows =
        resizeStrategy === ResizeStrategy.full
          ? (rowCount as number)
          : rowStopIndex || initialVisibleRows;
      let start = rowStartIndex;
      let maxWidth = minColumnWidth;
      while (start < visibleRows) {
        const value =
          getValue({
            rowIndex: start,
            columnIndex,
          }) ?? null;
        if (value !== null) {
          const metrics = autoSizer.current.measureText(value);
          if (metrics) {
            const width = Math.ceil(metrics.width) + cellSpacing;
            if (width > maxWidth) maxWidth = width;
          }
        }
        start++;
      }
      return maxWidth;
    },
    [viewport, getValue, initialVisibleRows]
  );

  const handleViewChange = useCallback(
    (cells: ViewPortProps) => {
      /* Update viewport cells */
      setViewport(cells);

      /* Check if viewport has changed */
      if (
        resizeStrategy === ResizeStrategy.full ||
        !resizeOnScroll ||
        (cells.rowStartIndex === viewport.rowStartIndex &&
          cells.columnStartIndex === viewport.columnStartIndex)
      )
        return;
      if (gridRef.current) {
        /* During first mount, column width is calculated. Do not re-calculate */
        if (!isMounted.current) return;
        debounceResizer.current({
          rowIndex: cells.rowStartIndex,
          columnIndex: cells.columnStartIndex,
        });
      }
    },
    [resizeOnScroll, viewport, resizeStrategy]
  );

  return {
    columnWidth: getColumnWidth,
    onViewChange: handleViewChange,
  };
};

/* Canvas element */
const AutoSizerCanvas = (defaultFont: string) => {
  const canvas = <HTMLCanvasElement>document.createElement("canvas");
  const context = canvas.getContext("2d");
  const setFont = (font: string = defaultFont) => {
    if (context) context.font = font;
  };
  const measureText = (text: string) => context?.measureText(text);
  /* Set font in constructor */
  setFont(defaultFont);

  return {
    context,
    measureText,
    setFont,
  };
};

export default useAutoSizer;

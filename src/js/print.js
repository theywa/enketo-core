'use strict';

/**
 * Deals with printing
 */

var $ = require( 'jquery' );
var dpi, printStyleSheet;
var $printStyleSheetLink;

// make sure setDpi is not called until DOM is ready
$( document ).ready( function() {
    setDpi();
} );

/**
 * Calculates the dots per inch and sets the dpi property
 */
function setDpi() {
    var dpiO = {};
    var e = document.body.appendChild( document.createElement( 'DIV' ) );
    e.style.width = '1in';
    e.style.padding = '0';
    dpiO.v = e.offsetWidth;
    e.parentNode.removeChild( e );
    dpi = dpiO.v;
}

/**
 * Gets print stylesheets
 * @return {Element} [description]
 */
function getPrintStyleSheet() {
    var sheet;
    // document.styleSheets is an Object not an Array!
    for ( var i in document.styleSheets ) {
        if ( document.styleSheets.hasOwnProperty( i ) ) {
            sheet = document.styleSheets[ i ];
            if ( sheet.media.mediaText === 'print' ) {
                return sheet;
            }
        }
    }
    return null;
}

function getPrintStyleSheetLink() {
    return $( 'link[media="print"]:eq(0)' );
}

/**
 * Applies the print stylesheet to the current view by changing stylesheets media property to 'all'
 */
function styleToAll() {
    // sometimes, setStylesheet fails upon loading
    printStyleSheet = printStyleSheet || getPrintStyleSheet();
    $printStyleSheetLink = $printStyleSheetLink || getPrintStyleSheetLink();
    // Chrome:
    printStyleSheet.media.mediaText = 'all';
    // Firefox:
    $printStyleSheetLink.attr( 'media', 'all' );
}

/**
 * Resets the print stylesheet to only apply to media 'print'
 */
function styleReset() {
    printStyleSheet.media.mediaText = 'print';
    $printStyleSheetLink.attr( 'media', 'print' );
    $( '.print-height-adjusted, .print-width-adjusted, .main' )
        .removeAttr( 'style' )
        .removeClass( 'print-height-adjusted print-width-adjusted' );
    $( '.back-to-screen-view' ).off( 'click' ).remove();
}

function isGrid() {
    return /theme-.*grid.*/.test( $( 'form.or' ).attr( 'class' ) );
}

function fixGrid( paper ) {
    var $row, $el, top, rowTop, maxWidth, diff;

    // to ensure cells grow correctly with text-wrapping before fixing heights and widths.
    $( '.main' ).css( 'width', getPaperPixelWidth( paper ) ).addClass( 'print-width-adjusted' );
    // wait for browser repainting after width change
    setTimeout( function() {
        // the -1px adjustment is necessary because the h3 element width is calc(100% + 1px)
        maxWidth = $( '#form-title' ).outerWidth() - 1;
        $( '.question, .note, .trigger' ).not( '.draft' ).each( function() {
            $el = $( this );
            top = $el.offset().top;
            rowTop = ( rowTop || rowTop === 0 ) ? rowTop : top;
            $row = $row || $el;

            if ( top === rowTop ) {
                $row = $row.add( $el );
            } else if ( top > rowTop ) {
                var height,
                    widths = [],
                    cumulativeWidth = 0,
                    maxHeight = 0;

                $row.each( function() {
                    height = $( this ).outerHeight();
                    maxHeight = ( height > maxHeight ) ? height : maxHeight;
                    widths.push( Number( $( this ).css( 'width' ).replace( 'px', '' ) ) );
                } );
                $row.addClass( 'print-height-adjusted' ).css( 'height', maxHeight + 'px' );

                // adjusts widths if w-values don't add up to 100%
                widths.forEach( function( width ) {
                    cumulativeWidth += width;
                } );

                if ( cumulativeWidth < maxWidth ) {

                    diff = maxWidth - cumulativeWidth;
                    $row.each( function( index ) {
                        var width = widths[ index ] + ( widths[ index ] / cumulativeWidth ) * diff;
                        // round down to 2 decimals to avoid 100.001% totals
                        $( this )
                            .css( 'width', ( Math.floor( ( width * 100 / maxWidth ) * 100 ) / 100 ) + '%' )
                            .addClass( 'print-width-adjusted' );
                    } );
                }
                // start a new row
                $row = $el;
                rowTop = $el.offset().top;
            } else {
                console.error( 'unexpected question top position: ', top, 'for element:', $el, 'expected >=', rowTop );
            }
        } );
        // Chrome 34 doesn't like the fact that main has an inline fixed width (see issue #99)
        // since we do not need it any more, after we have set the adjusted widths to a %-value, we can remove it. 
        $( '.main' ).css( 'width', 'auto' ).removeClass( 'print-width-adjusted' );

        $( window ).trigger( 'printviewready' );
    }, 1000 );
}

function getPaperPixelWidth( paper ) {
    var printWidth;
    // the final margin is determined by the browser's print functionality
    // better too large than too small here
    var margin = 0.4;
    var formats = {
        A4: {
            width: 8.27,
            height: 11.69
        },
        letter: {
            width: 8.5,
            height: 11
        }
    };

    printWidth = ( paper.orientation === 'portrait' ) ? formats[ paper.format ].width : formats[ paper.format ].height;

    return ( ( printWidth - ( 2 * margin ) ) * dpi ) + 'px';
}

/**
 * Show print setting dialog and proceed upon user's direction.
 */
function confirmPaperSettingsAndPrint( confirm ) {
    var texts = {
        dialog: 'print',
        heading: 'Select Print Settings'
    };
    var options = {
        posButton: 'Prepare',
        posAction: function( values ) {
            fixGrid( values );
            $( window ).one( 'printviewready', function() {
                window.print();
            } );
        },
        negButton: 'Close',
        negAction: function() {
            styleReset();
        },
        afterAction: function() {
            setTimeout( function() {
                styleReset();
            }, 1500 );
        }
    };

    // TODO: would be nice if fixGrid can become synchronous again or
    // a progress is shown when it is churning away.

    confirm( texts, options );
}

/**
 * Prints the form after first setting page breaks (every time it is called)
 */
function printForm( confirm ) {
    if ( isGrid() ) {
        styleToAll();
        // add temp reset button, just in case somebody gets stuck in print view
        $( '<button class="btn back-to-screen-view">Back to Normal View</button>' ).prependTo( $( 'form.or' ) ).on( 'click', function() {
            styleReset();
        } );
        confirmPaperSettingsAndPrint( confirm );
    } else {
        window.print();
    }
}

module.exports = printForm;
